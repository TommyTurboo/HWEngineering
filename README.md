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
- `TypicalInterface`
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
- defaultwaarden
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
- wat is de defaultwaarde
- is het kenmerk parametriseerbaar
- hoe mappen interne waarden terug naar de ETIM-semantiek

Belangrijk principe:

- **closed input by default**
- vrije tekst of vrije numerieke invoer alleen als expliciete uitzondering

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

Voorbeeld:

- een automaat met `number_of_poles = 3` genereert standaard:
  - `L1_IN`, `L2_IN`, `L3_IN`
  - `L1_OUT`, `L2_OUT`, `L3_OUT`

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

Lijst van alle `Equipment Typicals` met:

- naam
- ETIM-klasse
- status
- laatste wijzigingsdatum
- laatste bewerker

### 2. Typical Editor

Hoofdscherm met deze secties:

- `Algemeen`
- `Parameters`
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
- per parameterdefinitie kunnen inputtype, default, allowed values en governance-flags beheerd worden
- parameterdefinities kunnen als herbruikbare presets opgeslagen, toegepast en verwijderd worden
- interface-afleiding leest governed defaults, zoals poolaantal voor meerpolige schakeltoestellen
- validatie op parameterdefinitions is beschikbaar via een apart validatiepaneel
- validatie controleert onder meer enums zonder waarden, niet-numerieke `managed_numeric` waarden, booleans, duplicaten en interface-drivers zonder bruikbare default
- de editor waarschuwt nu bij niet-opgeslagen wijzigingen
- lokale end-to-end flow is gevalideerd via Docker en backend API-tests

## Next Step

De eerstvolgende implementatiestap is het uitwerken van een echt
interfacepaneel met overrides, zodat de afgeleide engineeringstructuur niet
alleen intern berekend maar ook expliciet beheerd kan worden.

Doel van deze stap:

- afgeleide interfaces zichtbaar maken voor de gebruiker
- handmatige interface-aanpassingen mogelijk maken zonder afleiding te verliezen
- derived en override duidelijk van elkaar onderscheiden

Concreet uit te werken:

- apart interfacepaneel in de editor
- tonen van:
  - interface code
  - rol
  - type
  - richting
  - bron `derived` of `override`
- handmatig interface toevoegen en verwijderen
- afgeleide interfaces opnieuw genereren zonder overrides stil te verliezen
- basisvalidatie op interfacecodes en inconsistenties

Waarom deze stap nu:

- create/edit, presets en validatie werken nu lokaal
- de belangrijkste ontbrekende engineeringoutput zit momenteel aan de interfacekant
- dit is de logische stap van parameterbeheer naar echte equipmentmodellering

## Lokale Start

Start de ontwikkelomgeving met:

```bash
docker compose up --build
```

Na het opstarten:

- frontend: `http://localhost:5173`
- backend: `http://localhost:8000/health`
- database: `localhost:5432`
