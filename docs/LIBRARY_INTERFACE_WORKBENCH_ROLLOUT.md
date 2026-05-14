# Library Interface Workbench rollout

## Nieuw in deze rollout

- Equipment Typical interfaces hebben layoutmetadata: `side` (`left`, `right`, `top`, `bottom`) en `side_order`.
- De Library Interface Workbench leeft naast de bestaande Library editor en gebruikt de backend derivation-preview.
- Driver parameters, mapping rules, resolved interface states, disabled interfaces en overrides zijn in de workbench scanbaar te beheren.
- De Library React Flow-preview en het Project Canvas gebruiken dezelfde interface-side/order semantiek.
- Projectinstances nemen interface-layout mee vanuit released typicals; bestaande instances zonder metadata blijven renderen via fallbackregels.

## Migratie en fallback

- Alembic-revisie `20260420_01` voegt `side` en `side_order` toe aan `typical_interfaces` en `instance_interfaces`.
- Runtime startup bevat dezelfde kolom-fallbacks voor lokale/dev databases die nog niet via Alembic zijn bijgewerkt.
- Oude group sides zoals `line`, `load`, `primary` en `secondary` worden genormaliseerd naar `left` en `right`.
- Interfaces zonder expliciete side vallen terug op direction: `in -> left`, `out -> right`, `bidirectional -> bottom`.
- `side_order` wordt stabiel afgeleid per zijde wanneer oude data geen bruikbare volgorde heeft.

## Rolloutcheck

- Bestaande Library-tabs blijven beschikbaar: `Typicals`, `Interface Workbench`, `Presets`, `Taxonomy`.
- De oude typical editor blijft de canonical save/release flow totdat de workbench minstens een volledige regressieronde met echte projectdata heeft gehad.
- Workbench mag nu gebruikt worden voor nieuwe draft-modellering en layoutcontrole, maar vervangt de oude editor nog niet.
- Project Canvas behoudt edgevalidatie op interfacecodes; gewijzigde of verwijderde codes blijven via bestaande prune/validatieregels behandeld.

## Verificatie 2026-05-14

- Backend contracttests draaien de preview-derivatie, fallback naar group/direction-side, disabled/override-validatie en projectinstance-layoutpropagatie.
- Frontend build controleert dat de nieuwe workbench naast de bestaande Library-routes compileert.
- Browsercheck controleert dat `Typicals`, `Interface Workbench`, `Presets`, `Taxonomy` en `Projects` laden. Als de backend niet draait, zijn netwerkerrors voor API-calls verwacht, maar de routes mogen niet crashen of uncaught stacktraces loggen.
- Lokale performancecheck met 181 parameters, 192 mappingregels en 8 driver values: alle previewvarianten werden in ongeveer 55 ms afgeleid.

## Nog buiten scope

- Drag-and-drop herordenen van handles; volgorde loopt voorlopig via numerieke `side_order`.
- Automatische datamigratie die oude persisted instances herschrijft; fallback houdt bestaande data bruikbaar zonder verplichte repair.
- Volledige UX-vervanging van de bestaande Library editor.
- Bulk performance-profielen op grote productiedatasets; huidige check is gericht op lokale devdata en meerdere driver values.

## Vervangingscriterium oude editor

Vervang de oude Library editor pas wanneer:

- save/release/draft-from-released flows door de workbench zelf volledig end-to-end zijn getest;
- bestaande presets en taxonomy beheer geen regressies tonen;
- een released typical met custom side/order visueel gelijk is in Library-preview en Project Canvas;
- performance acceptabel blijft bij veel ETIM-features en minimaal vier driverwaarden.
