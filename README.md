# HWEngineering

Repository voor de uitwerking van een ETIM-gedreven omgeving waarin `Equipment Typicals`
gedefinieerd, gevalideerd en versieerbaar beheerd kunnen worden.

## Doel

We bouwen een gedeelde engineeringomgeving waarin twee gebruikers samen
`Equipment Typicals` kunnen opzetten op basis van een `ETIM class`, met:

- parametriseerbare kenmerken
- afgeleide logische interfaces
- validatieregels
- draft en released versies

Het uitgangspunt is dat `ETIM` de semantische basis levert, maar dat een
`Equipment Typical` een extra engineeringlaag toevoegt.

## V1 Scope

De eerste versie focust op de modelkern:

- Equipment Typicals aanmaken op basis van een ETIM-klasse
- ETIM-features mappen naar typical parameters
- lokale engineeringparameters toevoegen
- interfaces afleiden op basis van rules
- overrides toelaten op afgeleide interfaces
- validatie uitvoeren
- draft en released versies beheren

Buiten scope voor V1:

- EPLAN-output
- BOM-generatie
- projectinstantiatie
- realtime collaborative editing
- grafische schema-editor

## Kernmodel

### ETIM-laag

- `EtimClass`
- `EtimFeature`
- `EtimValue`
- `EtimUnit`

### Engineering-laag

- `EquipmentTypical`
- `TypicalVersion`
- `TypicalParameter`
- `TypicalParameterDefinition`
- `TypicalInterfaceGroup`
- `TypicalInterface`
- `TypicalInterfaceMappingRule`
- `InterfaceRule`
- `TypicalConstraint`
- `TypicalOverride`
- `TypicalTemplate`

### Samenwerkingslaag

- `User`
- `AuditEvent`
- optimistic concurrency via versienummer

## Modellogica

### Verhouding ETIM en Equipment Typical

ETIM levert:

- classificatie
- featuredefinities
- datatype
- eenheden
- toegelaten waarden

De Equipment Typical-laag levert:

- engineeringnaam en interne code
- selectie van relevante parameters
- governance op parameterniveau
- optionele instelwaarden
- required versus optional
- interfacegedrag
- validatieregels
- overrides
- versiebeheer

### ETIM als bron, niet als invoervorm

ETIM bepaalt welke kenmerken bestaan, maar niet automatisch hoe de gebruiker ze
mag invullen.

Daarom komt er tussen `EtimFeature` en `TypicalParameter` een extra laag:

- `TypicalParameterDefinition`

Die laag bepaalt per geselecteerde ETIM-feature:

- wordt deze feature opgenomen in de typical of niet
- is de invoervorm `enum`, `boolean`, `fixed numeric list`, `range` of `fixed value`
- welke waarden zijn intern toegelaten
- wat is de optionele instelwaarde
- is het kenmerk parametriseerbaar
- hoe mappen interne waarden terug naar de ETIM-semantiek

Belangrijk principe:

- **closed input by default**
- vrije tekst of vrije numerieke invoer alleen als expliciete uitzondering

Interpretatie van `required` en `instelwaarde`:

- `required` betekent dat een parameter later op instance-niveau ingevuld moet zijn
- `instelwaarde` op typicalniveau is optioneel en dient alleen als voorstel
- een lege instelwaarde op typicalniveau is dus geldig

Voorbeelden:

- `Release characteristic`
  - ETIM biedt mogelijk `A, B, C, D, K, Z, Other`
  - de typicalbibliotheek kan dat beperken tot `B, C, D`
- `Number of poles (total)`
  - ETIM zegt numeriek
  - de bibliotheek maakt hiervan een enum `1, 2, 3, 4`
- `Rated current`
  - ETIM zegt numeriek in `A`
  - de bibliotheek maakt hiervan bijvoorbeeld een vaste keuzelijst
    `2, 4, 6, 10, 16, 20, 25, 32, 40, 63`

### Parameter governance

De volgende modelstap wordt dus niet:

- ETIM-features rechtstreeks als vrije parameters tonen

maar:

- ETIM-features selecteren
- omzetten naar `TypicalParameterDefinitions`
- en pas daarna een concrete typical parametriseren

Aanbevolen standaardregels:

- ETIM `A` -> standaard `enum`
- ETIM `L` -> `boolean`
- ETIM `N` -> alleen via beheerde lijst, range of vaste waarde
- ETIM `R` -> alleen expliciet toelaten waar zinvol
- vrije tekst standaard uitschakelen

### Interfaces

Interfaces worden hybride opgebouwd:

- het systeem genereert een voorstel op basis van parameters en rules
- de gebruiker kan dat voorstel aanpassen
- manuele afwijkingen worden als override opgeslagen

Het model maakt daarbij onderscheid tussen:

- `TypicalInterfaceGroup`
  - bijvoorbeeld `input_power`, `output_power`, `signal`, `protective_earth`
- `TypicalInterface`
  - concrete interface binnen zo'n groep
- `driver parameters`
  - parameters die de interfacecombinatie sturen

Voorbeeld:

- een schakeltoestel met `power_topology = 3L+N` genereert standaard:
  - in `input_power`: `L1_IN`, `L2_IN`, `L3_IN`, `N_IN`
  - in `output_power`: `L1_OUT`, `L2_OUT`, `L3_OUT`, `N_OUT`

### Configureerbare interfacecombinaties

De volgende noodzakelijke stap is dat interface-afleiding niet langer enkel
hardcoded per template gebeurt, maar via configureerbare mappings.

Daarvoor onderscheiden we:

- `TypicalParameterDefinition`
  - bijvoorbeeld `power_topology`, `spd_topology`, `wiring_type`
- `TypicalInterfaceGroup`
  - bijvoorbeeld `input_power`, `output_power`, `signal`
- `TypicalInterfaceMappingRule`
  - per parameterwaarde de interfaces die in een groep moeten ontstaan

Voorbeeld:

- driver parameter: `power_topology`
- waarde `L`
  - `input_power` -> `L_IN`
  - `output_power` -> `L_OUT`
- waarde `L+N`
  - `input_power` -> `L_IN`, `N_IN`
  - `output_power` -> `L_OUT`, `N_OUT`

Dat maakt het mogelijk om:

- topologies zelf te beheren
- per equipment family andere configuratie-parameters te gebruiken
- ook niet-symmetrische toestellen zoals voedingen en transfo's correct te modelleren

## Equipment Families

Nieuwe equipment types worden toegevoegd via dezelfde modelstructuur, niet via
aparte applicatielogica.

Eerste families:

- `automaat`
- `lastscheider`
- `voeding`
- `sensor`

Voorbeelden:

- `voeding`
  - parameters: ingangsspanning, uitgangsspanning, uitgangsstroom, aantal uitgangen
  - interfaces: AC in, PE, `+24V`, `0V`
- `lastscheider`
  - parameters: polen, nominale stroom, hulpcontact
  - interfaces: per pool een in- en uitgang
- `sensor`
  - parameters: signaaltype, draadsysteem, aantal kanalen
  - interfaces: voeding, signaal, eventueel shield of data

## Minimale UI

### 1. Bibliotheekoverzicht

Boomstructuur van alle `Equipment Typicals` met:

- een eigen bibliotheektaxonomie voor functionele navigatie
- fallback op ETIM-groepen zolang een typical nog niet in de eigen taxonomie geplaatst is
- per lineage alleen de laatste versie zichtbaar in de boom
- naam, status en versie op leaf-niveau

### 2. Typical Editor

Hoofdscherm met deze secties:

- `Algemeen`
- `Parameters`
- `Interface Groups`
- `Interface Mappings`
- `Interfaces`
- `Validatie`
- `Versies`

Belangrijkste acties:

- opslaan
- valideren
- interfaces opnieuw genereren
- releasen

## Technische Stack

Aanbevolen basisstack:

- Frontend: `React + TypeScript + Vite`
- Backend: `Python + FastAPI`
- Database: `PostgreSQL`
- ORM en migraties: `SQLAlchemy + Alembic`
- Validatie: `Pydantic`
- Frontend data layer: `TanStack Query`
- Formulieren: `React Hook Form + Zod`
- UI library: `Mantine` of `MUI`
- Lokale omgeving: `Docker Compose`

Belangrijke architectuurkeuzes:

- backend bevat de businesslogica
- relationele kern in PostgreSQL
- `jsonb` alleen voor flexibele metadata of rule-config
- geen microservices in V1
- schemawijzigingen verlopen voortaan via `Alembic` migraties

## Bibliotheektaxonomie

Naast de ETIM-classificatie komt er een eigen bibliotheekboom voor de UI.

Die laag bestaat uit:

- `library_nodes`
  - hiërarchische mappen of families
- `typical_library_links`
  - koppeling van een typical-lineage aan één of meer library nodes

Belangrijke regels:

- koppelingen gebeuren op `lineage_id`, niet op individuele versie-id
- de boom toont steeds de laatste versie van een lineage
- een typical kan in meerdere nodes voorkomen, met één primaire koppeling
- zolang er nog geen library nodes bestaan, blijft de UI terugvallen op de ETIM-groepen

## Fases

### Fase 1

- repo en basisstack opzetten
- PostgreSQL schema aanmaken
- ETIM-referentiemodel voorzien
- basis frontend en backend skeleton

### Fase 2

- Equipment Typical model implementeren
- parameterbeheer bouwen
- interface-rule engine bouwen
- validatie en versies toevoegen

### Fase 3

- eerste templates voor automaat, voeding en lastscheider
- UI verfijnen
- auditlog en conflictbeheer toevoegen

### Fase 4

- ETIM-features per klasse tonen
- featureselectie omzetten naar `TypicalParameterDefinitions`
- invoertypes en toegelaten waarden beheren
- interface-afleiding baseren op governed parameters in plaats van hardcoded local parameters

## Eerste Acceptatiecriteria

- een automaat kan aangemaakt worden vanuit een ETIM-klasse
- parameters zoals calibre, curve en aantal polen kunnen opgeslagen worden
- het aantal polen stuurt automatisch de basisinterfaces
- een gebruiker kan een interface override toevoegen
- validatie blokkeert release als verplichte parameters ontbreken
- een released typical is readonly
- parameterwaarden worden beheerd via gecontroleerde invoervormen in plaats van vrije tekst

## Huidige Status

- Git-repo lokaal geïnitialiseerd
- GitHub remote gekoppeld aan `origin`
- basis Docker stack voorzien voor `frontend`, `backend` en `db`
- ETIM-klasses kunnen gezocht en geselecteerd worden
- typicals kunnen aangemaakt, bewerkt en verwijderd worden
- geselecteerde ETIM-features kunnen omgezet worden naar `TypicalParameterDefinitions`
- per parameterdefinitie kunnen inputtype, instelwaarde, allowed values en governance-flags beheerd worden
- parameterdefinities kunnen als herbruikbare presets opgeslagen, toegepast en verwijderd worden
- interfacegroepen kunnen aangemaakt, aangepast en verwijderd worden
- interfaces kunnen aan groepen gekoppeld worden
- interface-afleiding leest governed instelwaarden en kent nu group-aware derived interfaces
- voor `multi_pole_switch_device` wordt nu `power_topology` gebruikt als primaire driver
- ondersteunde topologies voor de huidige bootstrap zijn:
  - `L`
  - `L+N`
  - `3L`
  - `3L+N`
- validatie op parameterdefinitions is beschikbaar via een apart validatiepaneel
- validatie controleert onder meer enums zonder waarden, niet-numerieke `managed_numeric` waarden, booleans, duplicaten, ongeldige group-links en ongeldige `power_topology` waarden
- de editor waarschuwt nu bij niet-opgeslagen wijzigingen
- lokale end-to-end flow is gevalideerd via Docker en backend API-tests
- hiërarchische typical tree via `MUI X Tree View` is actief
- eigen bibliotheektaxonomie is voorzien in backendmodellen en API
- Alembic-basissetup is toegevoegd voor nieuwe schemawijzigingen
- projectinstances kunnen nu naast inherited parameters ook suppressed en project-added parameters dragen
- projectinstances kunnen ook extra ETIM-features van dezelfde class opnemen zonder de released typical te wijzigen

## Next Step

De eerstvolgende implementatiestap is het uitwerken van een configureerbare
mappinglaag tussen parameterwaarden en interfacecombinaties.

Doel van deze stap:

- eigen lokale configuratieparameters kunnen toevoegen
- per parameterwaarde interfacecombinaties kunnen definiëren
- hardcoded topology- en template-afleiding stapsgewijs vervangen door beheerde mappings

Concreet uit te werken:

- tabel `typical_interface_mapping_rules`
- UI-tab of grid `Interface Mappings`
- lokale parameter toevoegen in `Parameters`
- per mappingregel configureerbaar:
  - driver parameter
  - driver value
  - interfacegroep
  - interface code
  - role
  - logical type
  - direction
- derived preview laten lezen uit mappingregels in plaats van alleen templatecode

Waarom deze stap nu:

- parameters, presets, interfacegroepen en overrides werken nu lokaal
- de huidige `power_topology` is bewust een bootstrap en nog niet zelf beheerbaar
- om toestellen zoals SPD, voeding en transfo correct te modelleren moet de gebruiker straks zelf configuratieopties en hun interfacegevolgen kunnen beheren

## Lokale Start

Start de ontwikkelomgeving met:

```bash
docker compose up --build
```

Na het opstarten:

- frontend: `http://localhost:5173`
- backend: `http://localhost:8000/health`
- database: `localhost:5432`
