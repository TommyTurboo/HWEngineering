import sqlite3
from collections import defaultdict
from functools import lru_cache

from app.config import settings
from app.schemas import (
    EtimClassDetail,
    EtimClassSummary,
    EtimFeatureDetail,
    EtimFeatureOption,
    EtimSearchResult,
)


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(settings.etim_db_path)
    conn.row_factory = sqlite3.Row
    return conn


@lru_cache(maxsize=1)
def _load_class_search_index() -> list[dict]:
    with _connect() as conn:
        class_rows = conn.execute(
            """
            SELECT
                a.ARTCLASSID,
                a.ARTCLASSDESC,
                a.ARTCLASSVERSION,
                a.ARTGROUPID,
                g.GROUPDESC
            FROM ETIM_ART_CLASS a
            LEFT JOIN ETIM_ART_GROUP g ON g.ARTGROUPID = a.ARTGROUPID
            ORDER BY a.ARTCLASSDESC
            """
        ).fetchall()
        synonym_rows = conn.execute(
            """
            SELECT ARTCLASSID, CLASSSYNONYM
            FROM ETIM_ART_CLASS_SYNONYM_MAP
            ORDER BY ARTCLASSID, CLASSSYNONYM
            """
        ).fetchall()

    synonyms_by_class: dict[str, list[str]] = defaultdict(list)
    for row in synonym_rows:
        synonym = row["CLASSSYNONYM"]
        if synonym:
            synonyms_by_class[row["ARTCLASSID"]].append(synonym)

    index: list[dict] = []
    for row in class_rows:
        synonyms = synonyms_by_class.get(row["ARTCLASSID"], [])
        index.append(
            {
                "id": row["ARTCLASSID"],
                "description": row["ARTCLASSDESC"] or "",
                "description_lower": (row["ARTCLASSDESC"] or "").lower(),
                "version": row["ARTCLASSVERSION"],
                "group_id": row["ARTGROUPID"],
                "group_description": row["GROUPDESC"],
                "synonyms": synonyms,
                "synonyms_lower": [item.lower() for item in synonyms],
            }
        )
    return index


def list_classes(search: str | None = None, limit: int = 25) -> list[EtimClassSummary]:
    query = """
        SELECT ARTCLASSID, ARTCLASSDESC, ARTCLASSVERSION, ARTGROUPID
        FROM ETIM_ART_CLASS
    """
    params: list[object] = []
    if search:
        query += " WHERE lower(ARTCLASSDESC) LIKE ? OR lower(ARTCLASSID) LIKE ?"
        token = f"%{search.lower()}%"
        params.extend([token, token])
    query += " ORDER BY ARTCLASSDESC LIMIT ?"
    params.append(limit)

    with _connect() as conn:
        rows = conn.execute(query, params).fetchall()

    return [
        EtimClassSummary(
            id=row["ARTCLASSID"],
            description=row["ARTCLASSDESC"],
            version=row["ARTCLASSVERSION"],
            group_id=row["ARTGROUPID"],
        )
        for row in rows
    ]


def search_classes_extended(search: str | None = None, limit: int = 25) -> list[EtimSearchResult]:
    normalized_limit = max(1, min(limit, 100))
    index = _load_class_search_index()
    if not search:
        return [
            EtimSearchResult(
                id=row["id"],
                description=row["description"],
                version=row["version"],
                group_id=row["group_id"],
                group_description=row["group_description"],
                matching_synonyms=[],
                matching_synonym_count=0,
                total_synonym_count=len(row["synonyms"]),
            )
            for row in index[:normalized_limit]
        ]

    token = search.lower().strip()
    scored_rows: list[tuple[int, int, int, str, dict, list[str]]] = []
    for row in index:
        direct_desc_match = 1 if token in row["description_lower"] else 0
        direct_id_match = 1 if token in row["id"].lower() else 0
        matching_synonyms = [item for item, item_lower in zip(row["synonyms"], row["synonyms_lower"]) if token in item_lower]
        if not direct_desc_match and not direct_id_match and not matching_synonyms:
            continue
        scored_rows.append(
            (
                direct_desc_match,
                direct_id_match,
                len(matching_synonyms),
                row["description"],
                row,
                matching_synonyms,
            )
        )

    scored_rows.sort(key=lambda item: (-item[0], -item[1], -item[2], item[3]))
    results: list[EtimSearchResult] = []
    for _, _, _, _, row, matching_synonyms in scored_rows[:normalized_limit]:
        results.append(
            EtimSearchResult(
                id=row["id"],
                description=row["description"],
                version=row["version"],
                group_id=row["group_id"],
                group_description=row["group_description"],
                matching_synonyms=matching_synonyms,
                matching_synonym_count=len(matching_synonyms),
                total_synonym_count=len(row["synonyms"]),
            )
        )
    return results


def get_art_group_descriptions(group_ids: list[str]) -> dict[str, str]:
    normalized = [group_id for group_id in group_ids if group_id]
    if not normalized:
        return {}

    placeholders = ",".join("?" for _ in normalized)
    query = f"""
        SELECT ARTGROUPID, GROUPDESC
        FROM ETIM_ART_GROUP
        WHERE ARTGROUPID IN ({placeholders})
    """
    with _connect() as conn:
        rows = conn.execute(query, normalized).fetchall()

    return {row["ARTGROUPID"]: row["GROUPDESC"] for row in rows}


def get_class_detail(art_class_id: str) -> EtimClassDetail | None:
    with _connect() as conn:
        class_row = conn.execute(
            """
            SELECT ARTCLASSID, ARTCLASSDESC, ARTCLASSVERSION, ARTGROUPID
            FROM ETIM_ART_CLASS
            WHERE ARTCLASSID = ?
            """,
            (art_class_id,),
        ).fetchone()

        if class_row is None:
            return None

        feature_rows = conn.execute(
            """
            SELECT
                m.ARTCLASSFEATURENR,
                m.FEATUREID,
                m.FEATURETYPE,
                m.UNITOFMEASID,
                m.SORTNR,
                f.FEATUREDESC,
                f.FEATUREGROUPID,
                fg.FEATUREGROUPDESC,
                u.UNITDESC
            FROM ETIM_ART_CLASS_FEATURE_MAP m
            LEFT JOIN ETIM_FEATURE f ON f.FEATUREID = m.FEATUREID
            LEFT JOIN ETIM_FEATURE_GROUP fg ON fg.FEATUREGROUPID = f.FEATUREGROUPID
            LEFT JOIN ETIM_UNIT u ON u.UNITOFMEASID = m.UNITOFMEASID
            WHERE m.ARTCLASSID = ?
            ORDER BY m.SORTNR, m.ARTCLASSFEATURENR
            """,
            (art_class_id,),
        ).fetchall()

        value_rows = conn.execute(
            """
            SELECT
                vmap.ARTCLASSFEATURENR,
                vmap.VALUEID,
                v.VALUEDESC,
                vmap.SORTNR
            FROM ETIM_ART_CLASS_FEATURE_VALUE_MAP vmap
            LEFT JOIN ETIM_VALUE v ON v.VALUEID = vmap.VALUEID
            WHERE vmap.ARTCLASSFEATURENR IN (
                SELECT ARTCLASSFEATURENR
                FROM ETIM_ART_CLASS_FEATURE_MAP
                WHERE ARTCLASSID = ?
            )
            ORDER BY vmap.ARTCLASSFEATURENR, vmap.SORTNR
            """,
            (art_class_id,),
        ).fetchall()

    values_by_feature: dict[str, list[EtimFeatureOption]] = defaultdict(list)
    for row in value_rows:
        values_by_feature[row["ARTCLASSFEATURENR"]].append(
            EtimFeatureOption(
                value_id=row["VALUEID"],
                value_description=row["VALUEDESC"] or row["VALUEID"],
                sort_order=row["SORTNR"],
            )
        )

    features = [
        EtimFeatureDetail(
            art_class_feature_nr=row["ARTCLASSFEATURENR"],
            feature_id=row["FEATUREID"],
            feature_description=row["FEATUREDESC"],
            feature_group_id=row["FEATUREGROUPID"],
            feature_group_description=row["FEATUREGROUPDESC"],
            feature_type=row["FEATURETYPE"],
            unit_id=row["UNITOFMEASID"],
            unit_description=row["UNITDESC"],
            sort_order=row["SORTNR"],
            values=values_by_feature.get(row["ARTCLASSFEATURENR"], []),
        )
        for row in feature_rows
    ]

    return EtimClassDetail(
        id=class_row["ARTCLASSID"],
        description=class_row["ARTCLASSDESC"],
        version=class_row["ARTCLASSVERSION"],
        group_id=class_row["ARTGROUPID"],
        features=features,
    )
