# Project Layer

Deze readme beschrijft de volgende grote stap na de bibliotheeklaag:
een projectomgeving bovenop de `released` equipment typicals.

## Doel

De bibliotheeklaag definieert:

- welke `Equipment Typicals` bestaan
- welke parameters toegelaten zijn
- welke interfacegroepen en mappings mogelijk zijn
- welke versies `draft` of `released` zijn

De projectlaag definieert:

- welke concrete componenten in een project gebruikt worden
- op welke `released typical` ze gebaseerd zijn
- welke parameterwaarden effectief gekozen zijn
- welke interfaces daardoor concreet gelden

Kort:

- `Typical` = bibliotheekdefinitie
- `Instance` = concrete projecttoepassing

## Kernprincipes

- alleen `released typicals` mogen geïnstantieerd worden
- projectinstances moeten stabiel blijven, ook als de bibliotheek later wijzigt
- parameterkeuzes mogen alleen uit toegelaten waarden komen
- interfaces worden op instance-niveau opnieuw afgeleid uit de gekozen waarden
- bibliotheekwijzigingen mogen bestaande projectinstances niet stilzwijgend veranderen

## Conceptueel Model

### 1. `Project`

Container voor een engineeringproject.

Velden:

- `id`
- `name`
- `code`
- `description`
- `status`
- `created_at`
- `updated_at`

### 2. `ProjectEquipmentInstance`

Een concrete component binnen een project, gebaseerd op een `released typical`.

Velden:

- `id`
- `project_id`
- `name`
- `tag`
- `description`
- `typical_id`
- `typical_lineage_id`
- `typical_version`
- `typical_code`
- `typical_name`
- `etim_class_id`
- `status`
- `created_at`
- `updated_at`

Belangrijk:

- `typical_id` wijst naar de gekozen released versie
- `typical_lineage_id` bewaart de familie van die typical
- `typical_version`, `typical_code` en `typical_name` worden mee gesnapshot

### 3. `InstanceParameterSelection`

De concrete parameterkeuzes van een instance.

Velden:

- `id`
- `instance_id`
- `parameter_code`
- `parameter_name`
- `source`
- `input_type`
- `unit`
- `selected_value`
- `sort_order`

Voorbeelden:

- `power_topology = 3L+N`
- `rated_current = 16`
- `release_characteristic = C`

### 4. `InstanceParameterDefinitionSnapshot`

Snapshot van de parameterdefinities op moment van instantiatie.

Velden:

- `id`
- `instance_id`
- `parameter_code`
- `parameter_name`
- `source`
- `input_type`
- `unit`
- `allowed_values_json`
- `default_value`
- `required`
- `is_parametrizable`
- `drives_interfaces`
- `sort_order`

Waarom nodig:

- projectinstances moeten stabiel blijven
- latere wijzigingen aan de bibliotheek mogen bestaande instances niet breken

### 5. `InstanceInterfaceGroup`

Snapshot van de interfacegroepen van de gekozen released typical.

Velden:

- `id`
- `instance_id`
- `code`
- `name`
- `category`
- `side`
- `sort_order`

### 6. `InstanceInterfaceMappingRuleSnapshot`

Snapshot van de mappingregels van de gekozen released typical.

Velden:

- `id`
- `instance_id`
- `driver_parameter_code`
- `driver_value`
- `group_code`
- `interface_code`
- `role`
- `logical_type`
- `direction`
- `sort_order`

### 7. `InstanceInterface`

De concrete interfaces van de projectinstance.

Velden:

- `id`
- `instance_id`
- `group_code`
- `code`
- `role`
- `logical_type`
- `direction`
- `source`
- `sort_order`

Dit is dus het echte resultaat van de instance-selecties.

## Waarom snapshots nodig zijn

De projectlaag mag niet live blijven leunen op mutable bibliotheekdata.

Voorbeeld:

- `Electric motor v1` wordt released
- project A maakt hier een instance van
- later komt `Electric motor v2`

Project A mag daardoor niet automatisch andere parameterdefinities of interfaces krijgen.

Daarom worden bij instance-creatie minstens deze zaken gesnapshot:

- parameter definitions
- interface groups
- interface mapping rules
- typical-identiteit en version metadata

## Businessregels

- alleen `released typicals` kunnen gebruikt worden voor nieuwe instances
- parameterselecties moeten voldoen aan de gesnapshotte definitions
- interfaces worden afgeleid uit:
  - de gekozen parameterwaarden
  - de gesnapshotte mappingregels
- een instance mag de bibliotheek niet wijzigen
- latere bibliotheekreleases mogen bestaande instances niet stil aanpassen

## API Voorstel

### Projecten

- `GET /api/v1/projects`
- `POST /api/v1/projects`
- `GET /api/v1/projects/{project_id}`
- `PUT /api/v1/projects/{project_id}`
- `DELETE /api/v1/projects/{project_id}`

### Instances

- `GET /api/v1/projects/{project_id}/instances`
- `POST /api/v1/projects/{project_id}/instances`
- `GET /api/v1/instances/{instance_id}`
- `PUT /api/v1/instances/{instance_id}`
- `DELETE /api/v1/instances/{instance_id}`

### Instance acties

- `POST /api/v1/instances/{instance_id}/derive-interfaces`
- `POST /api/v1/instances/{instance_id}/validate`

## Verwachte create-flow

1. gebruiker maakt een project aan
2. gebruiker opent het project
3. gebruiker kiest `Voeg instance toe`
4. gebruiker selecteert een `released typical`
5. backend maakt snapshots van:
   - parameter definitions
   - interface groups
   - mapping rules
6. backend maakt initiële parameterselecties
7. backend leidt initiële interfaces af
8. gebruiker past concrete parameterkeuzes aan
9. interfaces worden opnieuw afgeleid

## UI-flow

### 1. `Projecten`

Grid met:

- naam
- code
- status
- aantal instances
- laatste wijziging

Acties:

- nieuw project
- project openen
- project verwijderen

### 2. `Projectdetail`

Bevat:

- projectinfo
- lijst van equipment instances

Acties:

- `Voeg instance toe`

### 3. `Instance aanmaken`

Dialoog of zijpaneel:

- kies released typical
- geef naam
- geef tag

### 4. `Instance Editor`

Blokken:

- `Algemeen`
- `Parameterselectie`
- `Interfaces`
- `Validatie`

In `Parameterselectie` kiest de gebruiker alleen waarden die in de snapshot toegelaten zijn.

In `Interfaces` ziet de gebruiker de concrete afgeleide interface-uitkomst voor deze instance.

## Aanbevolen implementatiefasering

### Fase 1

- `projects` tabel
- `project_equipment_instances` tabel
- project CRUD
- released typical selecteren bij instance-creatie

### Fase 2

- snapshots van parameter definitions
- snapshots van groups en mapping rules
- initiale parameterselecties
- interface-afleiding op instance-niveau

### Fase 3

- instance editor
- instance validatie
- herafleiding na parameterwijziging

### Fase 4

- optionele instance-overrides
- latere uitbreidingen zoals verbindingen, kabels of exports

## Wat bewust nog niet in scope zit

- kabels tussen instances
- paneel- of kaststructuren
- documentgeneratie
- EPLAN-export
- geavanceerde netwerktopologie

Eerst moet de basis goed staan:

- project
- instance
- parameterselectie
- concrete interfaces

## Ontwerpkeuze

De projectlaag komt best in nieuwe modules, niet in de bestaande typical-editorlogica.

Aanbevolen backendmodules:

- `backend/app/projects.py`
- `backend/app/project_instances.py`

Aanbevolen frontenduitbreiding:

- nieuwe sectie `Projecten`
- nieuwe sectie `Instances`

Dus:

- bibliotheeklaag blijft bibliotheek
- projectlaag wordt een apart domein erboven
