import sqlite3
from collections import defaultdict

from app.config import settings
from app.schemas import EtimClassDetail, EtimClassSummary, EtimFeatureDetail, EtimFeatureOption


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(settings.etim_db_path)
    conn.row_factory = sqlite3.Row
    return conn


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
