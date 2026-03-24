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
- defaultwaarden
- required versus optional
- interfacegedrag
- validatieregels
- overrides
- versiebeheer

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

## Eerste Acceptatiecriteria

- een automaat kan aangemaakt worden vanuit een ETIM-klasse
- parameters zoals calibre, curve en aantal polen kunnen opgeslagen worden
- het aantal polen stuurt automatisch de basisinterfaces
- een gebruiker kan een interface override toevoegen
- validatie blokkeert release als verplichte parameters ontbreken
- een released typical is readonly

## Huidige Status

- Git-repo lokaal geïnitialiseerd
- GitHub remote gekoppeld aan `origin`
- README bevat de eerste projectrichting
