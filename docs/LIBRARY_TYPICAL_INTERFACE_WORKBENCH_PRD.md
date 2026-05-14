# PRD: Library Typical Interface Workbench

## Probleemstelling

De Library kan vandaag Equipment Typicals aanmaken op basis van een ETIM-classificatie en neemt daarbij automatisch ATIM/ETIM-features mee. Dat is waardevol, maar de huidige typical-editor brengt te veel domeinlagen tegelijk samen: parameter governance, interface groups, interface mapping rules, afgeleide interfaces, overrides, library placement en lifecycle. Daardoor wordt een eenvoudige taak, zoals een typical aanmaken en zien welke interfaces ontstaan, te technisch en traag.

De grootste frictie zit bij interfaces. Gebruikers moeten mappingregels en tabellen interpreteren om te begrijpen welke interfaces door parameterkeuzes ontstaan. Er is geen directe visuele feedback in de Library, terwijl het projectcanvas al bewijst dat React Flow geschikt is om equipment nodes en interfaces zichtbaar te maken. Bovendien worden interfaces op het projectcanvas vandaag hoofdzakelijk via richting gepositioneerd, waardoor gebruikers onvoldoende vrijheid hebben om interfaces links, rechts, boven of onder op een equipment node te plaatsen en zo kruisingen in tekeningen te vermijden.

Deze verandering is nu relevant omdat de Library de bron is van herbruikbare equipment knowledge. Als interfacegedrag daar niet snel, visueel en betrouwbaar te configureren is, verschuift complexiteit naar projectinstances en canvassen, waar die eigenlijk alleen geconsumeerd zou moeten worden.

## Oplossing

Bouw een nieuwe Library-workbench voor Equipment Typicals waarin gebruikers een typical vanuit een ETIM-classificatie kunnen opzetten, interfacegedrag visueel kunnen configureren en live kunnen controleren hoe parameterkeuzes de interfaces wijzigen.

De bestaande Library-tabs blijven voorlopig ongemoeid. De workbench komt als nieuwe tab of subtab naast de bestaande typical-editor. Alleen fundamentele gedeelde domein- of canvasmodellen mogen bestaande flows raken, en dan uitsluitend om hetzelfde gedrag herbruikbaar te maken.

De workbench gebruikt een dense Material UI admin/ERP formulierstijl, gebaseerd op de referentie `http://localhost:5173/?appTab=form&variant=A`:

- compacte commandbar bovenaan met primaire acties
- `DenseRow`-patroon met labels links en velden rechts
- MUI controls `size="small"` en outlined inputs
- dunne borders, weinig whitespace en geen grote decoratieve cards
- selecties via compacte RadioGroup cards/list/table of Autocomplete
- accentkleur via theme/tokens, niet hardcoded per component
- operationele, scanbare layout voor dagelijks engineeringwerk

De gebruiker ziet links of bovenaan een compacte formulier/editorzone en daarnaast een React Flow-preview van de draft typical. Bij elke relevante wijziging aan driver parameters, interface groups, mapping rules, overrides of interface layout wordt de preview opnieuw afgeleid en getoond.

## User Stories

1. Als library engineer wil ik een Equipment Typical kunnen starten vanuit een ETIM-classificatie, zodat de relevante ETIM-features automatisch als basis beschikbaar zijn.

2. Als library engineer wil ik de nieuwe workbench naast de bestaande Library-editor kunnen gebruiken, zodat bestaande workflows niet geblokkeerd worden tijdens de overgang.

3. Als library engineer wil ik een compacte commandbar met acties zoals opslaan, valideren, releasen, dupliceren en preview vernieuwen, zodat ik de workflow snel kan bedienen.

4. Als library engineer wil ik typical-identiteit, ETIM-classificatie en status in dense form rows kunnen beheren, zodat het scherm scanbaar blijft.

5. Als library engineer wil ik parameter governance in compacte rows of tabellen kunnen aanpassen, zodat ik snel kan bepalen welke parameters instelbaar zijn, interfaces sturen of op canvas zichtbaar zijn.

6. Als library engineer wil ik driver parameters kunnen aanduiden, zodat parameterwaardes automatisch interfaceconfiguraties kunnen sturen.

7. Als library engineer wil ik per driver value kunnen zien welke interfaces ontstaan, zodat de mappinglogica begrijpelijk wordt zonder ruwe regels te moeten lezen.

8. Als library engineer wil ik interface groups kunnen definiëren met naam, code, categorie en standaardzijde, zodat interfaces logisch gegroepeerd en visueel geplaatst worden.

9. Als library engineer wil ik individuele interfaces links, rechts, boven of onder op de equipment node kunnen plaatsen, zodat ik later overzichtelijke React Flow-tekeningen kan maken zonder onnodige lijnkruisingen.

10. Als library engineer wil ik de volgorde van interfaces per zijde kunnen aanpassen, zodat de node-layout voorspelbaar en documenteerbaar is.

11. Als library engineer wil ik afgeleide interfaces live zien op een React Flow-preview, zodat ik direct controleer of mijn parameterkeuzes het verwachte resultaat geven.

12. Als library engineer wil ik de preview kunnen schakelen tussen verschillende driver parameterwaardes, zodat ik alle varianten van een typical kan controleren.

13. Als library engineer wil ik derived interfaces kunnen uitschakelen of overriden met duidelijke herkomstweergave, zodat uitzonderingen expliciet blijven.

14. Als library engineer wil ik validatiefouten per row, interface en preview zichtbaar krijgen, zodat ik fouten kan herstellen voordat een typical released wordt.

15. Als project engineer wil ik dat released typicals op het projectcanvas dezelfde interface-layout gebruiken als in de Library-preview, zodat libraryconfiguratie en projectweergave overeenkomen.

16. Als project engineer wil ik dat bestaande projectinstances blijven werken wanneer nieuwe interface-layout metadata wordt toegevoegd, zodat bestaande projecten niet breken.

17. Als beheerder wil ik dat de bestaande Library-tab beschikbaar blijft tijdens de introductie van de workbench, zodat regressies makkelijk geïsoleerd kunnen worden.

18. Als beheerder wil ik dat de workbench dezelfde theme tokens gebruikt als de rest van de admin UI, zodat kleurgebruik consistent en onderhoudbaar blijft.

19. Als supportgebruiker wil ik kunnen zien of een interface derived, override of disabled is, zodat ik configuratieproblemen sneller kan verklaren.

20. Als ontwikkelaar wil ik één bron van waarheid voor interface-derivatie, zodat frontend-preview, backend-save en projectinstantiatie hetzelfde resultaat opleveren.

21. Als ontwikkelaar wil ik interface-layout en interface-direction gescheiden modelleren, zodat elektrische semantiek niet wordt gemengd met visuele plaatsing.

22. Als ontwikkelaar wil ik dat canvasedges gevalideerd blijven tegen bestaande interfacecodes, zodat gewijzigde interfaceconfiguraties geen verborgen ongeldige connecties veroorzaken.

23. Als gebruiker wil ik lege staten zien voor ontbrekende ETIM-keuze, ontbrekende driver parameter, lege mapping en lege preview, zodat duidelijk is wat de volgende actie is.

24. Als gebruiker wil ik dat de workbench performant blijft bij typicals met veel features en interfaces, zodat formulierinteractie en preview niet traag aanvoelen.

## Implementatiebeslissingen

- De eerste versie wordt als nieuwe Library-tab of subtab geïntroduceerd, bijvoorbeeld `Interface Workbench`, naast de bestaande typical-editor.

- De bestaande Library-editor blijft beschikbaar totdat de workbench functioneel gelijkwaardig of beter is voor typical-aanmaak en interfacebeheer.

- De workbench gebruikt het dense adminformulier als UI-contract: commandbar, `DenseRow`, small outlined MUI controls, compacte selectors, dunne borders en theme tokens.

- De React Flow-preview in de Library is een sandbox op typical-definitieniveau. Ze schrijft geen projectcanvasdata weg en maakt geen projectinstances aan.

- De node-rendering voor Library-preview en projectcanvas moet gedeeld of contractueel gelijk zijn. De Library configureert typical-layout metadata; het projectcanvas gebruikt die metadata voor instanceweergave.

- Interface-direction blijft domeinsemantiek: `in`, `out` of `bidirectional`.

- Interface-side wordt layoutsemantiek: `left`, `right`, `top` of `bottom`.

- Interface-side mag eerst uit interface group metadata worden afgeleid, maar individuele interfaces moeten een override kunnen krijgen.

- Interface-order wordt per zijde expliciet vastgelegd, zodat handles stabiel renderen.

- De backend krijgt een expliciet preview/derivation contract voor draft typicals. De frontend mag interface-derivatie niet zelfstandig anders berekenen dan de backend.

- De derivation module wordt een deep module met een smalle interface: input is een draft typical payload plus optionele parameter selections; output is resolved groups, resolved interfaces, layout hints, disabled/override status en validatie-issues.

- Persistente typicals blijven bij save dezelfde derivation gebruiken als de preview.

- Projectinstantiatie blijft snapshots nemen van released typicals, inclusief interface group, mapping rule en interface-layout metadata.

- Bestaande projectedges blijven gebaseerd op source/target handlecodes. Bij wijziging van interfacecodes blijven bestaande validatie- en prune-regels gelden.

- De workbench toont mappingregels primair als gebruikersgerichte matrix per driver parameter en driver value. Een ruwe gridweergave mag beschikbaar blijven als advanced/expert mode.

- Theme tokens worden centraal gebruikt. Componenten mogen geen eigen hardcoded accentkleuren introduceren.

- De eerste release hoeft nog geen volledige logical/physical interface-splitsing af te dwingen. De huidige hybride interfaces blijven een transitielaag, maar de nieuwe metadata mag die latere splitsing niet blokkeren.

## Testbeslissingen

- Test de interface-derivatie via het publieke derivation contract: dezelfde draft payload moet in preview, save en projectinstantiatie dezelfde interfaces opleveren.

- Test driver parameterwaarden met meerdere topologieën, waaronder enkelvoudige voeding, 3-fase, 3-fase plus nul, voeding met PE en een configuratie zonder matches.

- Test dat disabled derived interfaces verdwijnen uit resolved output, terwijl override interfaces zichtbaar blijven met correcte herkomst.

- Test dat interface-side en interface-order stabiel blijven bij opnieuw laden van een typical.

- Test dat de projectcanvas-node dezelfde interfacezijden gebruikt als de Library-preview voor een released typical.

- Test dat bestaande data zonder interface-side migreert naar een bruikbare default, bijvoorbeeld via group-side of direction fallback.

- Test validatiepaden: ontbrekende driver parameter, mapping naar onbekende group, duplicate interfacecode, lege interfacecode, onbekende side en conflicterende overrides.

- Test UI-gedrag met browserchecks op desktopbreedte: dense rows blijven uitgelijnd, commandbar blijft compact, preview is zichtbaar naast of onder de editor en tekst loopt niet uit controls.

- Test dat de bestaande Library-tabs nog laden en bestaande typicals nog aangemaakt, gewijzigd en gevalideerd kunnen worden zolang ze niet expliciet vervangen zijn.

- Test performance met een typical met veel ETIM-features en meerdere driver values: typen in velden en wijzigen van selectors mag geen merkbare blocking veroorzaken.

## Buiten Scope

- Volledige vervanging van de bestaande Library-editor in de eerste fase.

- Volledige logical/physical interface-splitsing.

- Functional Typicals of composities van meerdere Equipment Typicals.

- Materiaalselectie, fabrikantartikelen of EPLAN-artikelkoppeling.

- Fysieke kabel-, draad-, klem- of pinrealisatie.

- Nieuwe projectcanvas viewtypes zoals cabinet/field/overview splitsing.

- Automatische routering of optimalisatie van React Flow edges.

- Native SVG/PDF-exportwijzigingen buiten wat nodig is om interface-side correct te tonen.

## Verdere Opmerkingen

- Aanname: de term ATIM in de gebruikersvraag verwijst naar de bestaande ETIM/ATIM-classificatie- en featurebasis in de Library.

- Aanname: `side` op bestaande interface groups mag als migratiebron gebruikt worden, maar is semantisch nog niet scherp genoeg voor alle individuele interfaces.

- Belangrijk risico: als frontend-preview eigen derivatielogica houdt, ontstaat opnieuw drift tussen wat de gebruiker ziet en wat de backend opslaat.

- Belangrijk risico: als layout via `direction` gemodelleerd blijft, wordt vrije handleplaatsing moeilijk en verwarrend.

- Rolloutadvies: eerst metadata en derivation contract toevoegen, daarna Library-preview, daarna projectcanvas hergebruik, daarna pas de bestaande editor vereenvoudigen.

- GitHub issue publicatie is niet uitgevoerd omdat de lokale GitHub CLI-token ongeldig is. Deze PRD is wel issue-klaar en kan als body van een GitHub issue gebruikt worden.
