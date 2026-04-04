# UI Action Plan

Dit document beschrijft de volgende gerichte UI-herstructurering voor de applicatie.
De focus ligt niet op nieuwe domeinlogica, maar op een duidelijkere, professionelere
navigatie- en editorervaring bovenop de bestaande bibliotheek- en projectfunctionaliteit.

## Doel

De huidige applicatie bevat veel bruikbare functionaliteit, maar toont nog te veel
onderdelen tegelijk in één groot scherm. Dat verhoogt de cognitieve last en maakt
de navigatie minder vanzelfsprekend.

Dit actieplan moet de UI brengen naar een structuur met:

- duidelijke scheiding tussen `Library` en `Projects`
- consistente `master-detail` interactie
- compactere editors
- beter geplaatste acties
- minder visuele fragmentatie

## Ontwerpprincipes

- behoud technische naamgeving in de UI
- gebruik `MUI X` grids en tree components waar data lijstvormig of hiërarchisch is
- vermijd nieuwe card-op-card-op-card patronen
- toon slechts één primaire detailcontext tegelijk
- plaats acties zo dicht mogelijk bij het object waarop ze werken
- gebruik rustige headers en duidelijke secties in plaats van veel losse panels

## Hoofdstructuur

De applicatie wordt opgesplitst in twee hoofdmodi:

- `Library`
- `Projects`

Deze modes krijgen een duidelijke bovenste navigatie of segment control.

### Waarom

- de bibliotheeklaag en projectlaag hebben een andere mentale context
- gebruikers moeten niet tegelijk door taxonomy, presets, typicals en instances scrollen
- dit maakt de app leesbaarder en eenvoudiger uit te breiden

## Beoogde schermstructuur

## 1. `Library`

### Interne tabs

Binnen `Library` komen drie tabs:

- `Typicals`
- `Presets`
- `Taxonomy`

### Layout

- links: navigator
- rechts: detail/editor

### Verwachte inhoud per tab

#### `Typicals`

Links:

- typical tree
- library tree
- zoeken/filteren

Rechts:

- geselecteerde typical editor
- lifecycle-acties
- versions
- placement

#### `Presets`

Links:

- preset list/grid
- filters

Rechts:

- preset detail
- parameter setup
- bundle data
- mappings/groups indien van toepassing

#### `Taxonomy`

Links:

- library node tree

Rechts:

- selected node detail
- create child node
- rename/delete
- linked typical lineages

## 2. `Projects`

### Layout

- links: projects + instances navigator
- rechts: instance detail/editor

### Gedrag

Links:

- lijst van projecten
- na selectie: instances van dat project

Rechts:

- editor van de geselecteerde instance

### Waarom

- projectnavigatie en instancebewerking horen in één workflow
- create/edit/delete acties blijven binnen dezelfde context
- duplicatie en validatie worden veel duidelijker

## Master-detail patroon

Dit patroon wordt overal consequent toegepast:

- selectie links
- detail rechts

Belangrijk:

- geen meerdere gelijktijdige detailpanels naast elkaar voor hetzelfde domein
- createformulieren waar mogelijk integreren in lijstheaders of detailheaders
- detailpaneel bepaalt de primaire context van het scherm

## Actieplaatsing

Acties worden herverdeeld zodat ze dichter bij hun object staan.

### `Library`

- `Create typical` in de typical navigator header
- `Save`, `Validate`, `Release`, `New draft` in de typical detail header of sticky action bar
- `Placement` acties in de placementsectie of via tree/contextmenu
- presetbeheer in de `Presets` tab, niet verstopt in de typical editor

### `Projects`

- `Create project` in de projectlijst-header
- `Create instance` in de instances-header van het geselecteerde project
- `Save`, `Validate`, `Duplicate`, `Delete` in de instance detail header of sticky action bar

## Visual hierarchy

De UI moet minder bestaan uit gelijkwaardige losse panelen.

De bedoeling is:

- 1 duidelijke paginatitel
- 1 duidelijke linkernavigatie
- 1 primair werkvlak rechts
- secties binnen dat werkvlak

Concreet:

- minder geneste editor-panels
- minder herhaalde borders
- meer ruimte en hiërarchie via layout, headers en subtiele statusinformatie

## Sticky action bars

Editors krijgen bij voorkeur een sticky action bar.

### `Typical editor`

- `Save`
- `Validate`
- `Release`
- `New draft`

### `Instance editor`

- `Save`
- `Validate`
- `Duplicate`
- eventueel `Delete`

### Waarom

- kernacties blijven altijd beschikbaar
- minder scrollen
- duidelijkere primaire workflow

## Uitvoeringsfases

## Fase 1: globale modes

Doel:

- duidelijke split `Library | Projects`

Concrete stappen:

- top-level mode switch toevoegen
- alleen relevante content tonen per mode
- huidige lange gecombineerde pagina opsplitsen

## Fase 2: `Projects` master-detail

Doel:

- projectlaag als echte workspace laten aanvoelen

Concrete stappen:

- linker navigator voor projects
- instanceslijst onder geselecteerd project
- rechter instance editor
- create-acties naar navigatorheaders verplaatsen
- instance action bar sticky maken

## Fase 3: `Library` opdelen in tabs

Doel:

- taxonomy, presets en typicals niet langer door elkaar tonen

Concrete stappen:

- tabs `Typicals`, `Presets`, `Taxonomy`
- per tab eigen navigator links
- geselecteerde detail rechts

## Fase 4: acties en headers opschonen

Doel:

- minder losse knoppen verspreid in de UI

Concrete stappen:

- sticky action bars
- minder duplicate create/edit panels
- acties verplaatsen naar objectcontext

## Fase 5: visuele polish

Doel:

- rustiger, professioneler, consistenter

Concrete stappen:

- spacing uniformiseren
- statusblokken en badges verfijnen
- minder borders waar niet nodig
- consistent grid- en treegedrag

## Verwachte technische impact

### Frontend

Waarschijnlijk aan te passen bestanden:

- `frontend/src/App.tsx`
- `frontend/src/ProjectWorkspace.tsx`
- `frontend/src/TypicalLibraryTree.tsx`
- eventueel nieuwe componenten voor:
  - library shell
  - project shell
  - sticky action bars
  - navigator headers

### Aanbevolen nieuwe componenten

- `frontend/src/LibraryWorkspace.tsx`
- `frontend/src/LibraryTabs.tsx`
- `frontend/src/ProjectsNavigator.tsx`
- `frontend/src/InstanceActionBar.tsx`
- `frontend/src/TypicalActionBar.tsx`

Deze opsplitsing helpt om nieuwe werkbestanden gescheiden te houden van bestaande logica,
zoals eerder afgesproken.

## Buiten scope van dit actieplan

Dit document gaat niet over:

- nieuwe domeinlogica zoals `signal_topology` of `data_topology`
- nieuwe database-entiteiten
- kabeling of connecties tussen instances
- exportfunctionaliteit

Het doel is puur:

- navigatie
- schermstructuur
- editorervaring

## Aanbevolen eerstvolgende uitvoering

De slimste eerstvolgende stap is:

- **Fase 1 en Fase 2 samen uitvoeren**

Dus:

- top-level split `Library | Projects`
- projectomgeving omzetten naar echte master-detail workspace

Reden:

- dit levert meteen de grootste UX-winst op
- zonder al meteen heel de librarytabstructuur te moeten omgooien
- en houdt de projectlaag bruikbaar terwijl de bibliotheekstructuur later kan volgen
