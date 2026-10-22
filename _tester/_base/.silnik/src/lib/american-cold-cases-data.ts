import type { AdventureContext } from './adventures-data';

/**
 * AMERICAN MYTHOS COLD CASES (Dedicated English Quick Setup Scenarios - Issue #659)
 *
 * Four authentic American historical criminal mysteries adapted into Call of Cthulhu
 * investigative scenarios across four eras:
 * 1. 1893 (Gaslight) - H.H. Holmes's "Murder Castle" (Canonical Mythos: Non-Euclidean Yog-Sothoth architecture)
 * 2. 1924 (Classic)  - Leopold & Loeb / The Franks Affair (Subtle Weird/Occult: Hermetic Übermensch & Almer Coe lenses)
 * 3. 1983 (Noir)     - The Circleville Letters (Subtle Weird/Psychotronic: 18.9 Hz carrier wave & somnambulist contagion)
 * 4. 2005 (Modern)   - Todd Geib / Ovidhall Lake Anomaly (Canonical Mythos: Great Lakes Brood of Gla'aki stasis)
 */
export const AMERICAN_COLD_CASES_ADVENTURES: AdventureContext[] = [
  // ==========================================================================
  // 1. 1893 (GASLIGHT) - H.H. HOLMES'S MURDER CASTLE
  // ==========================================================================
  {
    id: 'englewood-murder-castle-1893',
    title: "The Englewood Labyrinth: Holmes's Castle",
    locale: 'en',
    era: 'gaslight',
    eraLabel: '1890s (Gaslight)',
    yearRange: '1893-1894',
    activeSceneYear: 1894,
    startDate: '1894-11-19T18:30',
    initialWeather: 'Freezing Lake Michigan sleet and thick coal-smoke fog over Englewood',
    location: '63rd & Wallace St., Englewood, Chicago',
    country: 'USA',
    tone: 'purist',
    themes: [
      'Non-Euclidean Architecture',
      '1893 World’s Fair',
      'Asphyxiation Vaults',
      'Missing Pitezel Children',
    ],
    suggestedOccupations: [
      'Police Detective',
      'Investigative Reporter',
      'Forensic Physician',
      'Master Builder',
    ],
    suggestedArchetypes: ['investigator', 'scholar', 'action', 'healer'],
    hook: 'Following Dr. H.H. Holmes’s arrest, investigators enter his three-story Englewood "Castle" of blind corridors, gas chambers, and cellar chutes before the building is burned to the ground.',
    description:
      'Following the arrest of Herman Webster Mudgett (Dr. H.H. Holmes) in Boston, Detective Frank Geyer and a team of specialists enter the abandoned three-story "Castle" at 63rd and Wallace Street in Chicago. Built for the 1893 World’s Columbian Exposition, the structure hides soundproof gas chambers, doors opening onto brick walls, and greased chutes descending to a basement kiln. What began as an insurance fraud and missing-children investigation unravels a terrifying non-Euclidean architectural machine designed to feed an interdimensional rift beneath Chicago.',
    investigatorIntro:
      'In November 1894, Dr. H.H. Holmes sits in a Philadelphia cell while Detective Frank Geyer arrives in Chicago to trace the missing Pitezel children and vanished World’s Fair stenographers. At the corner of 63rd and Wallace Street looms Holmes’s three-story Castle - a building whose construction crews were fired every two weeks so no living soul would know the layout of its thirty-five windowless second-floor rooms.',
    settingTrivia: [
      'During the 1893 World’s Columbian Exposition, over 27 million visitors passed through Chicago, allowing hundreds of disappearances in Englewood to go unrecorded.',
      'Holmes’s building at 63rd and Wallace featured a ground-floor pharmacy and retail shops, while the second floor contained a maze of soundproof rooms lined with iron plates and gas pipes controlled from his bedroom.',
      'Philadelphia Detective Frank Geyer famously tracked Holmes’s trail through Chicago, Indianapolis, and Toronto using unmailed letters from the Pitezel children.',
    ],
    estimatedSessions: '1-2',
    playerCount: '1-2',
    difficulty: 'normal',
    source: 'American Mythos Cold Cases',
    sourceCategory: 'oneshot',
    recommendedForBeginners: true,
    isStrefa11: true,
    isAmericanColdCase: true,
    documentType: 'scenario',
    isCampaign: false,
    activeNodeId: 'node-chicago-precinct',
    boundarySummary:
      'The operational zone covers the Englewood district of Chicago centered on 63rd and Wallace Street. Leaving the district before securing the basement kiln and the Pitezel evidence allows Holmes’s remaining accomplices to torch the building, destroying all forensic proof and unsealing the rift.',
    truthAnchor: {
      culprit:
        'Dr. Herman Webster Mudgett (H.H. Holmes) acting as high architect for an aspect of Yog-Sothoth (The Lurker at the Threshold)',
      motive:
        'Holmes fired construction crews every two weeks so no mortal mind could perceive the building’s true hyper-geometric blueprint - a three-dimensional projection of a four-dimensional digestive labyrinth that harvests human terror and calcified bone ash to hold open a dimensional aperture beneath Chicago.',
      murderWeapon:
        'Asphyxiation via town-gas valves controlled from Holmes’s third-floor bedroom, followed by acid dissolution and high-temperature calcination in the basement kiln.',
      keyAlibi:
        'Holmes is already locked in Moyamensing Prison in Philadelphia, claiming Benjamin Pitezel’s children are alive in London while his caretaker Pat Quinlan prepares to burn the Englewood Castle.',
      immutableFacts: [
        'The second floor of 63rd and Wallace Street contains 35 windowless rooms arranged in non-Euclidean angles that cause severe spatial disorientation and auditory hallucinations.',
        'Alice Pitezel’s unmailed letters hidden in a tin box at the bottom of the basement flue prove Holmes moved the children along a geometric ley line from Chicago to Indianapolis and Toronto.',
        'The iron door of the second-floor bank vault bears the chemically etched bare footprint of Emeline Cigrand, which cannot be scrubbed or filed away.',
        'Caretaker Pat Quinlan holds the master gas-valve key and has soaked the third-floor framing in kerosene to ignite the building at midnight.',
      ],
    },
    doomClock: {
      deadline: {
        year: 1894,
        month: 10,
        day: 20,
        hour: 2,
        minute: 0,
      },
      totalHours: 7.5,
      stages: [
        {
          phase: 0,
          title: 'Phase 0: The Warrant at 63rd Street',
          description:
            'Investigators enter the cordoned Castle grounds. Gas lamps flicker with a greenish halo, and caretakers watch from across Wallace Street.',
        },
        {
          phase: 1,
          title: 'Phase 1: Shifting Corridors',
          description:
            'Inside the second-floor maze, compass needles spin wildly. Hissing sounds echo through the walls as residual gas vents into sealed rooms.',
        },
        {
          phase: 2,
          title: 'Phase 2: Kerosene and Whispers',
          description:
            'Caretaker Pat Quinlan triggers the auxiliary gas valves and locks the fire escapes. The walls of the labyrinth begin to warp perceptibly.',
        },
        {
          phase: 3,
          title: 'Phase 3: The Kiln Awakens',
          description:
            'The basement furnace ignites without fuel. The non-Euclidean angles of the Castle align, opening a predatory spatial rift in the dissecting cellar.',
        },
      ],
    },
    secretsPool: [
      {
        id: 'sec-holmes-1',
        text: 'Overlaying the fragments of the second-floor blueprints reveals an impossible Penrose-like floorplan where three windowless rooms occupy more interior volume than the exterior brick facade allows.',
        isDiscovered: false,
      },
      {
        id: 'sec-holmes-2',
        text: 'Caretaker Pat Quinlan suffers from chronic insomnia because the greased metal chutes continue to echo with the sound of sliding bodies every night at 3:15 AM.',
        isDiscovered: false,
      },
      {
        id: 'sec-holmes-3',
        text: 'Dr. Holmes sold articulated human skeletons to Chicago medical colleges, but kept every victim’s temporal bone ground into a grey powder lining the basement kiln.',
        isDiscovered: false,
      },
      {
        id: 'sec-holmes-4',
        text: 'Emeline Cigrand’s etched footprint on the inside of the soundproof vault door emits a faint galvanic current when touched with brass instruments.',
        isDiscovered: false,
      },
      {
        id: 'sec-holmes-5',
        text: 'The pharmacy ledger on the ground floor lists regular deliveries of quicklime and oil of vitriol far exceeding any commercial apothecary in Illinois.',
        isDiscovered: false,
      },
      {
        id: 'sec-holmes-6',
        text: 'An Edison wax cylinder hidden inside Holmes’s bedroom wall safe captures the voice of an entity speaking back through the gas pipes during an asphyxiation.',
        isDiscovered: false,
      },
    ],
    graph: {
      nodes: [
        {
          id: 'node-chicago-precinct',
          name: 'Englewood Police Precinct & Detective Bureau',
          type: 'intro',
          description:
            'A soot-stained Victorian brick station house smelling of wet wool, pipe tobacco, and damp newsprint. Maps of the 1893 World’s Fairgrounds hang beside telegrams from Philadelphia Detective Frank Geyer and insurance adjusters.',
          atmosphere:
            'Clattering telegraph keys, horse-drawn patrol wagons outside, and growing dread as the victim count mounts.',
          locationId: 'loc-chicago-precinct',
          npcIds: ['npc-inspector-shea', 'npc-horace-gary'],
          leadInClueIds: ['clue-toronto-stovepipe-telegram'],
          leadOutClueIds: [
            'clue-pitezel-insurance-dossier',
            'clue-dismissed-masons-affidavit',
            'clue-missing-stenographers-list',
          ],
        },
        {
          id: 'node-castle-pharmacy',
          name: 'Ground-Floor Pharmacy & Jewellery Counter (63rd & Wallace)',
          type: 'location',
          isBottleneck: true,
          description:
            'The opulent street-level drugstore of Holmes’s Castle. Rows of cobalt-blue apothecary jars glint in the gaslight, masking the faint, sweet stench of chloroform and quicklime rising through the floorboards.',
          atmosphere:
            'Ticking regulator clock, chemical fumes, and a subtle vibration in the floorboards that sets glass stoppers chattering.',
          secret:
            'A concealed spring-latch behind the prescription desk opens both the secret stair to the second-floor maze and the dumbwaiter shaft to the basement.',
          locationId: 'loc-castle-pharmacy',
          npcIds: ['npc-charles-chappell'],
          leadInClueIds: [
            'clue-pitezel-insurance-dossier',
            'clue-hollow-wall-plumbline',
          ],
          leadOutClueIds: [
            'clue-apothecary-acid-ledger',
            'clue-hidden-stairwell-latch',
            'clue-quinlan-key-receipt',
          ],
        },
        {
          id: 'node-castle-second-floor',
          name: 'The Second-Floor Labyrinth & Soundproof Vault',
          type: 'location',
          isBottleneck: true,
          description:
            'Thirty-five windowless rooms connected by angled corridors, false partitions, hinged brickwork, and doors that open onto solid masonry. Iron plates line the asphyxiation chambers, wired to an electric indicator board in Holmes’s bedroom.',
          atmosphere:
            'Claustrophobic darkness, the hiss of residual coal gas, and angles that seem to lean inward when viewed from the corner of the eye.',
          secret:
            'The rooms are constructed as a three-dimensional hyper-geometric trap; walking the corridor counterclockwise shifts the investigator’s perception toward the basement rift.',
          locationId: 'loc-castle-second-floor',
          npcIds: ['npc-emeline-echo'],
          leadInClueIds: [
            'clue-missing-stenographers-list',
            'clue-hidden-stairwell-latch',
            'clue-quinlan-confession-note',
          ],
          leadOutClueIds: [
            'clue-vault-footprint-etching',
            'clue-edison-wax-cylinder',
            'clue-hollow-wall-plumbline',
          ],
        },
        {
          id: 'node-quinlan-quarters',
          name: 'Caretaker Pat Quinlan’s Courtyard Quarters',
          type: 'location',
          isBottleneck: true,
          description:
            'A cramped, kerosene-scented apartment overlooking the Castle’s inner courtyard. Stolen architectural fragments, plumber’s wrenches, and rosaries cover the walls around a man who has not slept in months.',
          atmosphere:
            'Flickering oil lamps, the smell of spilled kerosene, and the distant metallic groan of the Castle’s vertical chutes.',
          secret:
            'Pat Quinlan has been ordered to burn the Castle at midnight to seal what Holmes awakened in the cellar, unaware that fire will only feed the kiln.',
          locationId: 'loc-quinlan-quarters',
          npcIds: ['npc-pat-quinlan'],
          leadInClueIds: [
            'clue-dismissed-masons-affidavit',
            'clue-quinlan-key-receipt',
            'clue-edison-wax-cylinder',
          ],
          leadOutClueIds: [
            'clue-blueprint-castle-2nd-floor',
            'clue-quinlan-confession-note',
            'clue-toronto-stovepipe-telegram',
          ],
        },
        {
          id: 'node-castle-basement-climax',
          name: 'The Dissecting Cellar & Non-Euclidean Kiln (Climax)',
          type: 'climax',
          isBottleneck: true,
          isClimax: true,
          description:
            'Deep beneath 63rd Street, the greased wooden chute terminates beside acid vats, lime pits, surgical tables, and a massive brick crematorium. Inside the open flue, Alice Pitezel’s tin box rests beside a pulsing, multi-spherical geometric breach.',
          atmosphere:
            'Blinding iridescent spheres, the roar of an unlit furnace drawing air backward, and the smell of ozone and calcined bone.',
          secret:
            'Destroying the engraved keystone of the kiln and recovering the tin box of letters collapses the geometric circuit before the Lurker at the Threshold manifests.',
          locationId: 'loc-castle-basement',
          npcIds: ['npc-pat-quinlan', 'npc-threshold-manifestation'],
          leadInClueIds: [
            'clue-apothecary-acid-ledger',
            'clue-vault-footprint-etching',
            'clue-blueprint-castle-2nd-floor',
          ],
          leadOutClueIds: [],
        },
      ],
      clues: [
        {
          id: 'clue-pitezel-insurance-dossier',
          name: 'Fidelity Mutual Insurance Dossier on Benjamin Pitezel',
          description:
            'Case file compiled by Detective Frank Geyer showing a $10,000 life insurance policy and ciphered telegrams sent between Pitezel and Holmes’s ground-floor pharmacy at 63rd Street.',
          sourceType: 'document',
          clueType: 'core',
          sourceNodeId: 'node-chicago-precinct',
          targetNodeId: 'node-castle-pharmacy',
          requiredSkill: 'Library Use',
        },
        {
          id: 'clue-dismissed-masons-affidavit',
          name: 'Sworn Statements of Dismissed Bricklayers',
          description:
            'Police depositions from three different construction crews hired and fired in 1892, all pointing to caretaker Pat Quinlan’s quarters as the repository of the original architectural drawings.',
          sourceType: 'testimony',
          clueType: 'core',
          sourceNodeId: 'node-chicago-precinct',
          targetNodeId: 'node-quinlan-quarters',
          requiredSkill: 'Law',
        },
        {
          id: 'clue-missing-stenographers-list',
          name: 'Registry of Missing World’s Fair Stenographers',
          description:
            'List of young women - including Emeline Cigrand and Minnie Williams - last seen entering the second-floor apartments above Holmes’s drugstore.',
          sourceType: 'document',
          clueType: 'core',
          sourceNodeId: 'node-chicago-precinct',
          targetNodeId: 'node-castle-second-floor',
          requiredSkill: 'Spot Hidden',
        },
        {
          id: 'clue-apothecary-acid-ledger',
          name: 'Apothecary Ledger of Sulfuric Acid & Lime',
          description:
            'Hidden behind false tonic bottles in the pharmacy, this ledger records carboys of acid lowered directly into the basement via a freight dumbwaiter.',
          sourceType: 'document',
          clueType: 'core',
          sourceNodeId: 'node-castle-pharmacy',
          targetNodeId: 'node-castle-basement-climax',
          requiredSkill: 'Accounting',
        },
        {
          id: 'clue-hidden-stairwell-latch',
          name: 'Concealed Spring-Latch Behind the Pharmacy Counter',
          description:
            'A brass lever under the prescription desk that unlocks a narrow, windowless servants’ stair leading straight into the second-floor labyrinth.',
          sourceType: 'material',
          clueType: 'core',
          sourceNodeId: 'node-castle-pharmacy',
          targetNodeId: 'node-castle-second-floor',
          requiredSkill: 'Spot Hidden',
        },
        {
          id: 'clue-quinlan-key-receipt',
          name: 'Duplicate Gas-Main Work Order Signed by Pat Quinlan',
          description:
            'Plumbing invoice for custom cross-valves routed from the second floor to the caretaker’s rooms at the rear of the courtyard.',
          sourceType: 'document',
          clueType: 'core',
          sourceNodeId: 'node-castle-pharmacy',
          targetNodeId: 'node-quinlan-quarters',
          requiredSkill: 'Spot Hidden',
        },
        {
          id: 'clue-vault-footprint-etching',
          name: 'Acid-Etched Footprint on the Soundproof Vault Door',
          description:
            'Inside the iron-lined room on the second floor, a bare human footprint is burned into the metal plate right beside a hinged trapdoor opening into a vertical shaft to the cellar.',
          sourceType: 'anomaly',
          clueType: 'core',
          sourceNodeId: 'node-castle-second-floor',
          targetNodeId: 'node-castle-basement-climax',
          requiredSkill: 'Science (Chemistry)',
        },
        {
          id: 'clue-edison-wax-cylinder',
          name: 'Edison Phonograph Cylinder from Holmes’s Bedroom',
          description:
            'A brown wax cylinder labeled "Experiment IX - Room 14" found beside a manifold of brass gas levers and electric alarm buzzers wired to the caretaker’s lodge.',
          sourceType: 'material',
          clueType: 'core',
          sourceNodeId: 'node-castle-second-floor',
          targetNodeId: 'node-quinlan-quarters',
          requiredSkill: 'Listen',
        },
        {
          id: 'clue-hollow-wall-plumbline',
          name: 'Surveyor’s Plumb-Line Anomaly in the Blind Corridor',
          description:
            'Measurements between the hinged brick wall and the pharmacy ceiling below prove a four-foot spatial discrepancy that drains toward the ground-floor apothecary.',
          sourceType: 'anomaly',
          clueType: 'core',
          sourceNodeId: 'node-castle-second-floor',
          targetNodeId: 'node-castle-pharmacy',
          requiredSkill: 'Navigate',
        },
        {
          id: 'clue-blueprint-castle-2nd-floor',
          name: 'Composite Blueprint of the Second-Floor Labyrinth',
          description:
            'Pieced together in Quinlan’s quarters, the annotated architectural plan reveals the secret greased chute connecting the asphyxiation chambers to the basement kiln.',
          sourceType: 'document',
          clueType: 'core',
          sourceNodeId: 'node-quinlan-quarters',
          targetNodeId: 'node-castle-basement-climax',
          requiredSkill: 'Spot Hidden',
        },
        {
          id: 'clue-quinlan-confession-note',
          name: 'Pat Quinlan’s Unfinished Confession ("I Cannot Sleep")',
          description:
            'Trembling testimony from the caretaker admitting that Holmes locked victims in the second-floor rooms using electric bell indicators above his bed.',
          sourceType: 'testimony',
          clueType: 'core',
          sourceNodeId: 'node-quinlan-quarters',
          targetNodeId: 'node-castle-second-floor',
          requiredSkill: 'Psychology',
        },
        {
          id: 'clue-toronto-stovepipe-telegram',
          name: 'Western Union Telegram Regarding the Irvington Stove',
          description:
            'A telegram tucked in Quinlan’s coat linking the Englewood basement furnace to Holmes’s trail investigated at the precinct.',
          sourceType: 'document',
          clueType: 'core',
          sourceNodeId: 'node-quinlan-quarters',
          targetNodeId: 'node-chicago-precinct',
          requiredSkill: 'Persuade',
        },
      ],
      connections: [
        {
          fromId: 'node-chicago-precinct',
          toId: 'node-castle-pharmacy',
          clueId: 'clue-pitezel-insurance-dossier',
          description:
            'Fidelity Mutual telegrams trace Benjamin Pitezel’s dealings directly to Holmes’s ground-floor pharmacy.',
        },
        {
          fromId: 'node-chicago-precinct',
          toId: 'node-quinlan-quarters',
          clueId: 'clue-dismissed-masons-affidavit',
          description:
            'Bricklayers’ depositions identify caretaker Pat Quinlan as the holder of the fragmented floorplans.',
        },
        {
          fromId: 'node-chicago-precinct',
          toId: 'node-castle-second-floor',
          clueId: 'clue-missing-stenographers-list',
          description:
            'Missing persons reports place Emeline Cigrand and Minnie Williams in the second-floor apartments.',
        },
        {
          fromId: 'node-castle-pharmacy',
          toId: 'node-castle-basement-climax',
          clueId: 'clue-apothecary-acid-ledger',
          description:
            'Acid and quicklime records point straight down the freight dumbwaiter into the dissecting cellar.',
        },
        {
          fromId: 'node-castle-pharmacy',
          toId: 'node-castle-second-floor',
          clueId: 'clue-hidden-stairwell-latch',
          description:
            'The hidden spring-latch behind the counter opens the narrow stair into the second-floor maze.',
        },
        {
          fromId: 'node-castle-pharmacy',
          toId: 'node-quinlan-quarters',
          clueId: 'clue-quinlan-key-receipt',
          description:
            'Custom gas-valve invoices lead to caretaker Pat Quinlan’s courtyard rooms.',
        },
        {
          fromId: 'node-castle-second-floor',
          toId: 'node-castle-basement-climax',
          clueId: 'clue-vault-footprint-etching',
          description:
            'The trapdoor beside Emeline Cigrand’s acid-etched footprint drops directly into the cellar chute.',
        },
        {
          fromId: 'node-castle-second-floor',
          toId: 'node-quinlan-quarters',
          clueId: 'clue-edison-wax-cylinder',
          description:
            'Wiring from Holmes’s recording manifold runs directly to the caretaker’s courtyard quarters.',
        },
        {
          fromId: 'node-castle-second-floor',
          toId: 'node-castle-pharmacy',
          clueId: 'clue-hollow-wall-plumbline',
          description:
            'Plumb-line measurements lead back down to the hollow shafts behind the pharmacy ceiling.',
        },
        {
          fromId: 'node-quinlan-quarters',
          toId: 'node-castle-basement-climax',
          clueId: 'clue-blueprint-castle-2nd-floor',
          description:
            'The composite blueprint reveals the hidden subterranean kiln and vertical disposal chute.',
        },
        {
          fromId: 'node-quinlan-quarters',
          toId: 'node-castle-second-floor',
          clueId: 'clue-quinlan-confession-note',
          description:
            'Quinlan’s confession identifies the exact soundproof rooms on the second floor.',
        },
        {
          fromId: 'node-quinlan-quarters',
          toId: 'node-chicago-precinct',
          clueId: 'clue-toronto-stovepipe-telegram',
          description:
            'The Western Union telegram ties the Castle’s furnace to Detective Geyer’s precinct files.',
        },
      ],
      npcs: [
        {
          id: 'npc-inspector-shea',
          name: 'Inspector John Shea (Chicago Police)',
          description:
            'Veteran Chicago Police inspector overwhelmed by the sheer scale of corruption and missing visitors left in the wake of the 1893 World’s Fair.',
          secret:
            'City Hall pressured him to classify the Englewood disappearances as runaway cases to protect Exposition tourism.',
        },
        {
          id: 'npc-horace-gary',
          name: 'Horace Gary (Fidelity Mutual Counsel)',
          description:
            'Sharp-eyed Philadelphia insurance attorney who uncovered Holmes’s cadaver-substitution fraud.',
          secret:
            'Suspects that Benjamin Pitezel was terrified of something inside the Chicago building long before his death.',
        },
        {
          id: 'npc-charles-chappell',
          name: 'Charles Chappell (Articulator & Clerk)',
          description:
            'Pale, nervous technician who articulated human skeletons for Holmes to sell to medical schools.',
          secret:
            'Noticed strange geometric carvings on the inside of the skulls he bleached on the second floor.',
        },
        {
          id: 'npc-pat-quinlan',
          name: 'Pat Quinlan (The Castle Caretaker)',
          description:
            'Gaunt, hollow-eyed janitor of the Englewood building who guarded the upper floors for Holmes.',
          secret:
            'Haunted by voices in the chutes, he plans to burn the entire block down tonight to silence the basement.',
        },
        {
          id: 'npc-emeline-echo',
          name: 'Dimensional Echo of Emeline Cigrand',
          description:
            'A temporal impression of Holmes’s former stenographer trapped within the non-Euclidean angles of the soundproof vault.',
          secret:
            'Points toward the chute release lever that leads to Alice Pitezel’s letters in the basement.',
        },
        {
          id: 'npc-threshold-manifestation',
          name: 'The Geometry in the Kiln (Aspect of Yog-Sothoth)',
          description:
            'A conglomerate of rotating, iridescent angles and burning bone-ash coalescing inside the basement furnace.',
          secret:
            'Anchored by the carved keystone in the kiln arch; shattering the keystone collapses the spatial anomaly.',
        },
      ],
      locations: [
        {
          id: 'loc-chicago-precinct',
          name: 'Englewood Police Precinct',
          description:
            'Brick police headquarters in Englewood holding the impounded files and telegrams of the Holmes-Pitezel investigation.',
          atmosphere: 'Gas lamps, telegraph clicks, and damp November chill.',
        },
        {
          id: 'loc-castle-pharmacy',
          name: 'Holmes’s Ground-Floor Pharmacy (63rd & Wallace)',
          description:
            'Street-level drugstore and shopfront concealing the entrances to the upper labyrinth and basement shafts.',
          atmosphere: 'Cobalt glass, smell of chloroform and lime, and creaking timber above.',
        },
        {
          id: 'loc-castle-second-floor',
          name: 'The Second-Floor Labyrinth',
          description:
            'Thirty-five windowless rooms, false doors, asphyxiation chambers, and iron-plated vaults.',
          atmosphere:
            'Suffocating silence broken by hissing gas pipes and impossible corridor angles.',
        },
        {
          id: 'loc-quinlan-quarters',
          name: 'Caretaker Pat Quinlan’s Quarters',
          description:
            'Courtyard rooms where the building’s janitor keeps the stolen architectural plans and gas keys.',
          atmosphere: 'Reek of kerosene, whispered prayers, and drafty brick walls.',
        },
        {
          id: 'loc-castle-basement',
          name: 'The Dissecting Cellar & Kiln',
          description:
            'Subterranean vault beneath the Castle containing acid vats, lime pits, the disposal chute, and the non-Euclidean furnace.',
          atmosphere: 'Searing ozone, alchemical ash, and warping spatial geometry.',
        },
      ],
    },
    externalLinks: [
      {
        label: 'Wikipedia (H.H. Holmes & Murder Castle)',
        url: 'https://en.wikipedia.org/wiki/H._H._Holmes',
      },
      {
        label: 'GSU Library (19th Century True Crime - Frank Geyer)',
        url: 'https://blog.library.gsu.edu/2011/10/27/scary-stuff-true-crime-in-american-history-19th-century-style/',
      },
    ],
    handouts: [
      {
        slug: 'blueprint-castle-2nd-floor',
        title: 'Composite Blueprint: 63rd & Wallace St. (Second Floor)',
        image: '/handouts/englewood-murder-castle-1893/blueprint-castle-2nd-floor.webp',
        handoutType: 'map',
        nodeId: 'node-quinlan-quarters',
        textContent:
          'Architectural survey of the 2nd floor at 63rd & Wallace St., Chicago (1893). Note: Room 14 (Asphyxiation Vault) and Room 22 share an impossible 114-degree interior partition concealing Vertical Chute B to the basement kiln.',
      },
      {
        slug: 'letter-alice-pitezel-tin',
        title: 'Alice Pitezel’s Unmailed Letter (Found in Flue Tin)',
        image: '/handouts/englewood-murder-castle-1893/letter-alice-pitezel-tin.webp',
        handoutType: 'letter',
        nodeId: 'node-castle-basement-climax',
        textContent:
          'Dearest Mama, Mr. Holmes says we may not go outside until Papa returns, and that the rooms upstairs have no windows because the Chicago air is bad for Howard’s lungs. At night the iron chute in the wall hums like a beehive...',
      },
      {
        slug: 'coroner-footprint-vault',
        title: 'Forensic Sketch: Acid-Etched Footprint on Vault Door',
        image: '/handouts/englewood-murder-castle-1893/coroner-footprint-vault.webp',
        handoutType: 'report',
        nodeId: 'node-castle-second-floor',
        textContent:
          'Cook County Coroner’s Exhibit D (Nov 1894): Indelible chemical impression of a female right foot etched into the Bessemer steel lining of the second-floor vault door. The metal around the toes shows crystalline warping.',
      },
      {
        slug: 'audio-edison-wax-cylinder',
        title: 'Edison Wax Cylinder: "Experiment IX - Room 14"',
        image: '/handouts/englewood-murder-castle-1893/coroner-footprint-vault.webp',
        audioUrl: '/audio/handouts/englewood-murder-castle-1893/edison-wax-cylinder-1893.mp3',
        handoutType: 'report',
        nodeId: 'node-castle-second-floor',
        textContent:
          'Edison phonograph recording recovered from Holmes’s bedroom safe: needle scratch, the hiss of opening gas valves, a calm voice counting minutes, and a resonant, multi-tonal vibration answering from inside the iron chute.',
      },
    ],
  },

  // ==========================================================================
  // 2. 1924 (CLASSIC) - LEOPOLD & LOEB / THE FRANKS AFFAIR
  // ==========================================================================
  {
    id: 'almer-coe-spectacles-1924',
    title: 'The Almer Coe Spectacles: The Franks Affair',
    locale: 'en',
    era: 'classic',
    eraLabel: 'Roaring Twenties (1924)',
    yearRange: '1924',
    activeSceneYear: 1924,
    startDate: '1924-05-23T20:00',
    initialWeather: 'Warm spring mist rolling off Lake Michigan and the Calumet marshes',
    location: 'Hyde Park - Wolf Lake - Kenwood, Chicago',
    country: 'USA',
    tone: 'noir',
    themes: [
      'The Perfect Crime',
      'Almer Coe Eyeglasses',
      'University of Chicago Hermeticism',
      'Wolf Lake Culvert',
    ],
    suggestedOccupations: [
      'State’s Attorney Investigator',
      'Crime Reporter',
      'University Professor',
      'Private Detective',
    ],
    suggestedArchetypes: ['investigator', 'scholar', 'trickster', 'action'],
    hook: 'A pair of custom horn-rimmed spectacles dropped beside a Wolf Lake drainage culvert leads to two brilliant University of Chicago prodigies performing a cold Hermetic experiment in "Superior Will".',
    description:
      'Forty-eight hours after the body of 14-year-old Bobby Franks is discovered stuffed into a concrete drainage culvert near Wolf Lake, investigators examine a pair of horn-rimmed eyeglasses dropped in the marsh grass. Equipped with a rare patented hinge sold by Almer Coe & Co. to only three people in Chicago, the spectacles lead into the privileged halls of the University of Chicago and the mansions of Kenwood, where two brilliant students - Nathan Leopold and Richard Loeb - have turned a forgotten Hermetic treatise on "Superior Will" into a cold-blooded ritual of intellectual transcendence.',
    investigatorIntro:
      'On May 22, 1924, the body of millionaire’s son Bobby Franks is found in a railway culvert near Wolf Lake. Beside the pipe lies a single pair of tortoise-shell spectacles with a rare patented hinge. What the newspapers call a ransom kidnapping is in truth the first half of a cold-blooded philosophical and occult experiment orchestrated by two of Chicago’s brightest university prodigies.',
    settingTrivia: [
      'The real 1924 Leopold and Loeb case was cracked when police traced the custom hinge of the eyeglasses found at Wolf Lake to Almer Coe & Co., which had sold only three such pairs in all of Chicago.',
      'Nathan Leopold was an accomplished ornithologist who used bird-watching expeditions in the Wolf Lake and Calumet marshes to scout the disposal site.',
      'Family chauffeur Sven Englund provided the decisive testimony that shattered the killers’ alibi by proving Leopold’s car never left the garage on the afternoon of the murder.',
    ],
    estimatedSessions: '1-2',
    playerCount: '1-2',
    difficulty: 'easy',
    source: 'American Mythos Cold Cases',
    sourceCategory: 'oneshot',
    recommendedForBeginners: true,
    isStrefa11: true,
    isAmericanColdCase: true,
    documentType: 'scenario',
    isCampaign: false,
    activeNodeId: 'node-wolf-lake-culvert',
    boundarySummary:
      'The investigation spans South Side Chicago (Kenwood, Hyde Park, Downtown Almer Coe Optical, and the Calumet/Wolf Lake marshes). Delaying past dawn on May 25 allows the culprits to destroy the portable Underwood typewriter in Jackson Park Lagoon and execute the second sacrifice in the Calumet boathouse.',
    truthAnchor: {
      culprit:
        'Nathan Leopold Jr. and Richard Loeb (operating a private Hermetic lodge at the University of Chicago)',
      motive:
        'Obsessed with a radical occult distortion of Nietzsche’s Übermensch found in a 17th-century Hermetic manuscript, the pair believe that committing an emotionless, mathematically "perfect" murder while observing the victim through specially ground quartz lenses severs human conscience and grants absolute dominion over fate.',
      murderWeapon:
        'A heavy steel cold chisel wrapped in adhesive tape, followed by hydrochloric acid poured to erase facial identity.',
      keyAlibi:
        'Leopold and Loeb claim they spent the afternoon of May 21 bird-watching in Lincoln Park and drinking in Leopold’s family automobile, unaware that chauffeur Sven Englund can prove the family car never left the Kenwood garage.',
      immutableFacts: [
        'There are no supernatural monsters in the marshes; the horror is entirely driven by aristocratic occultism, cold intellect, and forensic precision.',
        'Almer Coe & Co. sold only three pairs of horn-rimmed spectacles with the patented "X-Bridge" hinge in Chicago, and only one matches Nathan Leopold’s astigmatism prescription.',
        'The ransom letter signed "George Johnson" was typed on a portable Underwood typewriter whose lowercase "t" and "m" strike 0.4 millimeters off-center, matching Leopold’s study group notes.',
        'Chauffeur Sven Englund repaired the brakes on the red Willys-Knight in the Leopold garage all afternoon on May 21, shattering the suspects’ alibi.',
      ],
    },
    doomClock: {
      deadline: {
        year: 1924,
        month: 5,
        day: 24,
        hour: 23,
        minute: 59,
      },
      totalHours: 28,
      stages: [
        {
          phase: 0,
          title: 'Phase 0: The Glasses in the Marsh',
          description:
            'Police and reporters swarm the Wolf Lake culvert. The killers mingle boldly with journalists in Hyde Park, offering theories on the crime.',
        },
        {
          phase: 1,
          title: 'Phase 1: Erasing the Paper Trail',
          description:
            'Typewriter keys are twisted with pliers and dropped into the Jackson Park Lagoon. A hydrochloric acid bottle is shattered in the marsh.',
        },
        {
          phase: 2,
          title: 'Phase 2: The Alibi Conspiracy',
          description:
            'Family lawyers led by high-society fixers begin pressuring witnesses in Kenwood, while a second victim is selected to complete the Hermetic dyad.',
        },
        {
          phase: 3,
          title: 'Phase 3: The Second Experiment at Calumet',
          description:
            'Under cover of marsh fog, the rental automobile returns to the abandoned Calumet boathouse to complete the final rite of the "crime without emotion".',
        },
      ],
    },
    secretsPool: [
      {
        id: 'sec-franks-1',
        text: 'The lenses in the dropped spectacles from Almer Coe & Co. contain a faint smoky-quartz tint ground to a non-standard refractive index used in 19th-century psychic photography.',
        isDiscovered: false,
      },
      {
        id: 'sec-franks-2',
        text: 'Richard Loeb has been actively shadowing police reporters at the Detective Bureau, feeding them false leads about a professional kidnapping syndicate.',
        isDiscovered: false,
      },
      {
        id: 'sec-franks-3',
        text: 'Inside the University of Chicago rare-book seminar room, a Latin folio titled "De Voluntate Absoluta" has had three pages on ritual infanticide sliced out with a razor.',
        isDiscovered: false,
      },
      {
        id: 'sec-franks-4',
        text: 'Chauffeur Sven Englund noticed dark stains of hydrochloric acid and blood on the rubber floor mat of a rented Willys-Knight parked briefly behind the Kenwood carriage house.',
        isDiscovered: false,
      },
      {
        id: 'sec-franks-5',
        text: 'Leopold’s celebrated ornithological notebook on the Kirtland’s Warbler uses bird-banding coordinates around Wolf Lake to map sightlines for body disposal.',
        isDiscovered: false,
      },
      {
        id: 'sec-franks-6',
        text: 'The ransom demand to Jacob Franks was never meant to collect money; the $10,000 figure and the train-window drop instructions correspond to a numeric cipher in the stolen seminar treatise.',
        isDiscovered: false,
      },
    ],
    graph: {
      nodes: [
        {
          id: 'node-wolf-lake-culvert',
          name: 'Wolf Lake Drainage Culvert & Railroad Embankment',
          type: 'intro',
          description:
            'A desolate expanse of cattails, stagnant marsh water, and cinder-covered tracks of the Pennsylvania Railroad twenty miles south of Chicago. A concrete drainage pipe juts from the mud where Bobby Franks’s body was discovered at dawn.',
          atmosphere:
            'Croaking marsh frogs, the distant whistle of freight trains, damp peat, and the sharp chemical tang of spilled acid.',
          locationId: 'loc-wolf-lake-culvert',
          npcIds: ['npc-tony-minke', 'npc-det-gaughan'],
          leadInClueIds: ['clue-coroner-chisel-autopsy', 'clue-alchemy-acid-requisition'],
          leadOutClueIds: [
            'clue-horn-rimmed-glasses',
            'clue-ornithology-boot-tracks',
            'clue-willys-knight-tire-cast',
          ],
        },
        {
          id: 'node-almer-coe-opticians',
          name: 'Almer Coe & Co. Optical Establishment (Wabash Ave)',
          type: 'location',
          isBottleneck: true,
          description:
            'A refined Loop optician’s showroom with mahogany display cases, brass phoropters, and meticulous card-index cabinets containing the eyewear prescriptions of Chicago’s wealthiest families.',
          atmosphere:
            'The quiet ticking of precision grinders, polished glass, and the tense hush of an urgent state’s attorney inquiry.',
          secret:
            'The index cards prove only three pairs of those exact horn-rimmed glasses exist in Chicago, and the smoky-quartz lenses were custom-ordered by Nathan Leopold.',
          locationId: 'loc-almer-coe-opticians',
          npcIds: ['npc-edward-bohm', 'npc-robert-crowe'],
          leadInClueIds: ['clue-horn-rimmed-glasses'],
          leadOutClueIds: [
            'clue-almer-coe-prescription-card',
            'clue-quartz-lens-analysis',
            'clue-coroner-chisel-autopsy',
          ],
        },
        {
          id: 'node-uchicago-archive',
          name: 'University of Chicago Seminar Room & Rare Book Vault',
          type: 'location',
          isBottleneck: true,
          description:
            'Gothic limestone halls in Hyde Park. Oak tables hold ornithological taxidermy alongside locked glass cases of Continental philosophy and 17th-century Hermetic treatises.',
          atmosphere:
            'Dust motes in stained-glass light, smell of leather bindings, and the chilling arrogance of privileged prodigies.',
          secret:
            'Leopold and Loeb used a private seminar alcove to type the ransom note on Leopold’s portable Underwood and design a two-part ritual of "intellectual sovereignty".',
          locationId: 'loc-uchicago-archive',
          npcIds: ['npc-richard-loeb'],
          leadInClueIds: [
            'clue-ornithology-boot-tracks',
            'clue-quartz-lens-analysis',
            'clue-jackson-park-typewriter-keys',
          ],
          leadOutClueIds: [
            'clue-underwood-typeface-match',
            'clue-uchicago-hermetic-notes',
            'clue-alchemy-acid-requisition',
          ],
        },
        {
          id: 'node-leopold-mansion-garage',
          name: 'The Leopold Mansion & Carriage Garage (4754 Greenwood Ave)',
          type: 'location',
          isBottleneck: true,
          description:
            'An imposing Kenwood millionaire’s estate near Jackson Park. In the brick carriage house behind the mansion, a red Willys-Knight sits beside workbenches, birding gear, and freshly scrubbed floor mats.',
          atmosphere:
            'The smell of motor oil, wet lagoon weeds, and wealthy impunity cracking under forensic scrutiny.',
          secret:
            'Chauffeur Sven Englund knows the boys lied about using the family car on May 21, and has seen the map to the Calumet boathouse.',
          locationId: 'loc-leopold-mansion-garage',
          npcIds: ['npc-sven-englund', 'npc-clarence-darrow'],
          leadInClueIds: [
            'clue-willys-knight-tire-cast',
            'clue-almer-coe-prescription-card',
            'clue-underwood-typeface-match',
          ],
          leadOutClueIds: [
            'clue-englund-chauffeur-testimony',
            'clue-jackson-park-typewriter-keys',
            'clue-calumet-duck-blind-map',
          ],
        },
        {
          id: 'node-calumet-boathouse-climax',
          name: 'The Abandoned Calumet Marsh Boathouse (Climax)',
          type: 'climax',
          isBottleneck: true,
          isClimax: true,
          description:
            'A rotting timber boathouse on stilts over the black waters of the Calumet marshes. Inside, kerosene lanterns illuminate a chalk-drawn geometric diagram from "De Voluntate Absoluta", optical tripods, and the two students preparing their final "experiment beyond good and evil".',
          atmosphere:
            'Lapping black water against pilings, smell of marsh gas and gun oil, and the chilling, detached calm of two minds devoid of remorse.',
          secret:
            'Confronting Leopold and Loeb with the Almer Coe spectacles and Sven Englund’s testimony shatters their delusion of intellectual infallibility, forcing a desperate armed standoff before they can execute their second victim.',
          locationId: 'loc-calumet-boathouse',
          npcIds: ['npc-nathan-leopold', 'npc-richard-loeb'],
          leadInClueIds: [
            'clue-uchicago-hermetic-notes',
            'clue-englund-chauffeur-testimony',
            'clue-calumet-duck-blind-map',
          ],
          leadOutClueIds: [],
        },
      ],
      clues: [
        {
          id: 'clue-horn-rimmed-glasses',
          name: 'Horn-Rimmed Spectacles with Patented Hinge',
          description:
            'Found on the cinder embankment beside the Wolf Lake culvert. The tortoise-shell frame features a rare, newly patented temple hinge stamped by Almer Coe & Co. on Wabash Avenue.',
          sourceType: 'material',
          clueType: 'core',
          sourceNodeId: 'node-wolf-lake-culvert',
          targetNodeId: 'node-almer-coe-opticians',
          requiredSkill: 'Spot Hidden',
        },
        {
          id: 'clue-ornithology-boot-tracks',
          name: 'Field-Boot Impressions & Bird-Banding Ring',
          description:
            'Distinctive rubber-soled wading tracks beside the culvert along with a stamped aluminum bird-banding ring issued to the University of Chicago Ornithological Club.',
          sourceType: 'material',
          clueType: 'core',
          sourceNodeId: 'node-wolf-lake-culvert',
          targetNodeId: 'node-uchicago-archive',
          requiredSkill: 'Track',
        },
        {
          id: 'clue-willys-knight-tire-cast',
          name: 'Plaster Cast of Balloon Tires & Acid Burn',
          description:
            'Tire tracks from a heavy touring sedan along the marsh road, stained with spilled hydrochloric acid and fine red garage gravel used in Kenwood driveways.',
          sourceType: 'material',
          clueType: 'core',
          sourceNodeId: 'node-wolf-lake-culvert',
          targetNodeId: 'node-leopold-mansion-garage',
          requiredSkill: 'Science (Forensics)',
        },
        {
          id: 'clue-almer-coe-prescription-card',
          name: 'Almer Coe & Co. Prescription Ledger #419-C',
          description:
            'Optical sales records proving only three customers in Chicago bought the patented hinge frame, and only Nathan Leopold Jr. of 4754 Greenwood Ave. left his pair uncollected at home.',
          sourceType: 'document',
          clueType: 'core',
          sourceNodeId: 'node-almer-coe-opticians',
          targetNodeId: 'node-leopold-mansion-garage',
          requiredSkill: 'Library Use',
        },
        {
          id: 'clue-quartz-lens-analysis',
          name: 'Refractive Analysis of the Spectacle Lenses',
          description:
            'The chief optician notes that the customer paid extra to have the lenses ground from smoky Bohemian quartz according to an archaic optical diagram from the University of Chicago.',
          sourceType: 'testimony',
          clueType: 'core',
          sourceNodeId: 'node-almer-coe-opticians',
          targetNodeId: 'node-uchicago-archive',
          requiredSkill: 'Persuade',
        },
        {
          id: 'clue-coroner-chisel-autopsy',
          name: 'Cook County Coroner’s Report on the Chisel Blows',
          description:
            'Autopsy notes annexed at the optical inquest showing the blows were struck with cold, geometric symmetry and the body was bathed in laboratory-grade acid.',
          sourceType: 'document',
          clueType: 'core',
          sourceNodeId: 'node-almer-coe-opticians',
          targetNodeId: 'node-wolf-lake-culvert',
          requiredSkill: 'Medicine',
        },
        {
          id: 'clue-underwood-typeface-match',
          name: 'Seminar Thesis Typed on the Ransom Underwood',
          description:
            'Law-school study notes in the University archive show the exact same battered "t" and "m" typeface as the "George Johnson" ransom letter, along with a receipt from Drive-It-Yourself Rent-A-Car.',
          sourceType: 'document',
          clueType: 'core',
          sourceNodeId: 'node-uchicago-archive',
          targetNodeId: 'node-leopold-mansion-garage',
          requiredSkill: 'Spot Hidden',
        },
        {
          id: 'clue-uchicago-hermetic-notes',
          name: 'Ornithological Notebook with Hermetic Margin Cipher',
          description:
            'Leopold’s field journal combining Kirtland’s Warbler sightings with quotes from "De Voluntate Absoluta", pinpointing an abandoned boathouse on the Calumet marsh for the second "Act of Will".',
          sourceType: 'document',
          clueType: 'core',
          sourceNodeId: 'node-uchicago-archive',
          targetNodeId: 'node-calumet-boathouse-climax',
          requiredSkill: 'Occult',
        },
        {
          id: 'clue-alchemy-acid-requisition',
          name: 'Chemistry Department Requisition for Hydrochloric Acid',
          description:
            'A signed laboratory slip for two liters of concentrated HCl matching the chemical burns found at the Wolf Lake culvert.',
          sourceType: 'document',
          clueType: 'core',
          sourceNodeId: 'node-uchicago-archive',
          targetNodeId: 'node-wolf-lake-culvert',
          requiredSkill: 'Science (Chemistry)',
        },
        {
          id: 'clue-englund-chauffeur-testimony',
          name: 'Chauffeur Sven Englund’s Garage Log & Testimony',
          description:
            'The family chauffeur swears Nathan’s red touring car was on blocks in the Kenwood garage all day May 21, and that he saw the pair loading a chisel and rope into a rented sedan headed for the Calumet boathouse.',
          sourceType: 'testimony',
          clueType: 'core',
          sourceNodeId: 'node-leopold-mansion-garage',
          targetNodeId: 'node-calumet-boathouse-climax',
          requiredSkill: 'Psychology',
        },
        {
          id: 'clue-jackson-park-typewriter-keys',
          name: 'Twisted Typewriter Keys Dredged from Jackson Park Lagoon',
          description:
            'Broken key-bars from an Underwood portable typewriter recovered near the mansion, confirming the forensic link to the University seminar notes.',
          sourceType: 'material',
          clueType: 'core',
          sourceNodeId: 'node-leopold-mansion-garage',
          targetNodeId: 'node-uchicago-archive',
          requiredSkill: 'Spot Hidden',
        },
        {
          id: 'clue-calumet-duck-blind-map',
          name: 'Hand-Drawn Map of Calumet Duck Blinds & Boathouse',
          description:
            'Hidden in the glove compartment of the Leopold car, this map marks the Wolf Lake culvert as "Site Alpha" and the old Calumet Boathouse as "Site Omega - Tonight".',
          sourceType: 'document',
          clueType: 'core',
          sourceNodeId: 'node-leopold-mansion-garage',
          targetNodeId: 'node-calumet-boathouse-climax',
          requiredSkill: 'Navigate',
        },
      ],
      connections: [
        {
          fromId: 'node-wolf-lake-culvert',
          toId: 'node-almer-coe-opticians',
          clueId: 'clue-horn-rimmed-glasses',
          description:
            'The patented hinge on the dropped horn-rimmed spectacles traces directly to Almer Coe & Co. on Wabash Avenue.',
        },
        {
          fromId: 'node-wolf-lake-culvert',
          toId: 'node-uchicago-archive',
          clueId: 'clue-ornithology-boot-tracks',
          description:
            'An aluminum bird-banding ring in the mud leads to the University of Chicago ornithology seminar.',
        },
        {
          fromId: 'node-wolf-lake-culvert',
          toId: 'node-leopold-mansion-garage',
          clueId: 'clue-willys-knight-tire-cast',
          description:
            'Balloon tire tracks and red Kenwood driveway gravel point to the Leopold estate garage.',
        },
        {
          fromId: 'node-almer-coe-opticians',
          toId: 'node-leopold-mansion-garage',
          clueId: 'clue-almer-coe-prescription-card',
          description:
            'Prescription card #419-C identifies Nathan Leopold Jr. of 4754 Greenwood Avenue as the owner of the glasses.',
        },
        {
          fromId: 'node-almer-coe-opticians',
          toId: 'node-uchicago-archive',
          clueId: 'clue-quartz-lens-analysis',
          description:
            'The custom smoky-quartz lens grinding specification originated from a treatise at the University of Chicago.',
        },
        {
          fromId: 'node-almer-coe-opticians',
          toId: 'node-wolf-lake-culvert',
          clueId: 'clue-coroner-chisel-autopsy',
          description:
            'Coroner’s chemical findings send investigators back to inspect the culvert water and embankment.',
        },
        {
          fromId: 'node-uchicago-archive',
          toId: 'node-leopold-mansion-garage',
          clueId: 'clue-underwood-typeface-match',
          description:
            'Matching Underwood typewriter defects and a rental car slip lead to Leopold’s Kenwood residence.',
        },
        {
          fromId: 'node-uchicago-archive',
          toId: 'node-calumet-boathouse-climax',
          clueId: 'clue-uchicago-hermetic-notes',
          description:
            'Leopold’s annotated ornithological journal pinpoints the Calumet marsh boathouse for the final rite.',
        },
        {
          fromId: 'node-uchicago-archive',
          toId: 'node-wolf-lake-culvert',
          clueId: 'clue-alchemy-acid-requisition',
          description:
            'Stolen hydrochloric acid records connect the university lab to the culvert disposal site.',
        },
        {
          fromId: 'node-leopold-mansion-garage',
          toId: 'node-calumet-boathouse-climax',
          clueId: 'clue-englund-chauffeur-testimony',
          description:
            'Chauffeur Sven Englund destroys the alibi and reveals the pair’s departure toward the Calumet boathouse.',
        },
        {
          fromId: 'node-leopold-mansion-garage',
          toId: 'node-uchicago-archive',
          clueId: 'clue-jackson-park-typewriter-keys',
          description:
            'Twisted Underwood keys from the nearby lagoon match the seminar thesis in Hyde Park.',
        },
        {
          fromId: 'node-leopold-mansion-garage',
          toId: 'node-calumet-boathouse-climax',
          clueId: 'clue-calumet-duck-blind-map',
          description:
            'The hand-drawn marsh map marks the Calumet Boathouse as "Site Omega - Tonight".',
        },
      ],
      npcs: [
        {
          id: 'npc-tony-minke',
          name: 'Tony Minke (Pump Station Worker)',
          description:
            'Polish-born night watchman and pump tender who discovered Bobby Franks’s foot protruding from the Wolf Lake culvert.',
          secret:
            'Picked up the horn-rimmed glasses thinking they were his own before handing them to police.',
        },
        {
          id: 'npc-edward-bohm',
          name: 'Edward Bohm (Master Optician, Almer Coe & Co.)',
          description:
            'Meticulous optical craftsman who personally fitted the patented X-Bridge hinges.',
          secret:
            'Remembers Nathan Leopold insisting that the lenses be ground at a precise 19-degree prism angle.',
        },
        {
          id: 'npc-sven-englund',
          name: 'Sven Englund (Leopold Family Chauffeur)',
          description:
            'Honest, observant Swedish mechanic employed by the Leopold household in Kenwood.',
          secret:
            'Saw Nathan and Richard scrubbing hydrochloric acid stains out of a rented car while the family Willys-Knight sat immobile on blocks.',
        },
        {
          id: 'npc-nathan-leopold',
          name: 'Nathan Leopold Jr.',
          description:
            'Nineteen-year-old ornithologist, polyglot, and law student convinced that superior intellect places him above mortal law and occult taboo.',
          secret:
            'Terrified of realizing that a mundane mistake - dropping his spectacles from his jacket pocket - ruined his "perfect geometric act".',
        },
        {
          id: 'npc-richard-loeb',
          name: 'Richard Loeb',
          description:
            'Eighteen-year-old charmer and the youngest graduate of the University of Michigan, driven by a cold compulsion for dominance and secrecy.',
          secret:
            'Carries a loaded .32 revolver and plans to silence anyone - including Leopold - if the Calumet boathouse is compromised.',
        },
        {
          id: 'npc-robert-crowe',
          name: 'State’s Attorney Robert E. Crowe',
          description:
            'Relentless Cook County prosecutor determined to break the suspects before their wealthy families can spirit them out of the country.',
          secret:
            'Holding secret night sessions at the LaSalle Hotel to keep defense lawyers off balance.',
        },
        {
          id: 'npc-clarence-darrow',
          name: 'Clarence Darrow',
          description:
            'Legendary defense attorney summoned by the families, deeply disturbed by the cold philosophical void he sees in the two boys.',
          secret:
            'Wants the investigators to stop a second murder at Calumet so he can save the boys from the gallows without further bloodshed.',
        },
      ],
      locations: [
        {
          id: 'loc-wolf-lake-culvert',
          name: 'Wolf Lake Culvert & Pennsylvania Railroad Tracks',
          description:
            'Marshy industrial wasteland in Hegewisch on the Illinois-Indiana border.',
          atmosphere: 'Reeds, stagnant water, cinder embankments, and freight trains.',
        },
        {
          id: 'loc-almer-coe-opticians',
          name: 'Almer Coe & Co. Opticians (105 N. Wabash Ave)',
          description:
            'Premier Chicago optical company holding the city’s custom eyewear records.',
          atmosphere: 'Polished brass, optical charts, and quiet bureaucratic precision.',
        },
        {
          id: 'loc-uchicago-archive',
          name: 'University of Chicago Seminar & Archive (Hyde Park)',
          description:
            'Gothic university halls where Leopold and Loeb studied law, ornithology, and forbidden philosophy.',
          atmosphere: 'Neo-Gothic stone, hushed corridors, and elitist secrecy.',
        },
        {
          id: 'loc-leopold-mansion-garage',
          name: 'Leopold Estate & Garage (4754 Greenwood Ave, Kenwood)',
          description:
            'Wealthy South Side mansion and brick carriage house near Jackson Park Lagoon.',
          atmosphere:
            'Manicured lawns, smell of gasoline and lagoon mud, and nervous servants.',
        },
        {
          id: 'loc-calumet-boathouse',
          name: 'Abandoned Calumet Marsh Boathouse',
          description:
            'Isolated timber boathouse deep in the Calumet reed beds used as a private birding and ritual station.',
          atmosphere: 'Thick night fog, creaking pilings, and kerosene lantern glare.',
        },
      ],
    },
    externalLinks: [
      {
        label: 'Wikipedia (Leopold and Loeb)',
        url: 'https://en.wikipedia.org/wiki/Leopold_and_Loeb',
      },
      {
        label: 'Northwestern University Archive (Homicide in Chicago 1924)',
        url: 'https://homicide.northwestern.edu/crimes/leopold/',
      },
    ],
    handouts: [
      {
        slug: 'almer-coe-prescription-card',
        title: 'Almer Coe & Co. Optical Prescription Card #419-C',
        image: '/handouts/almer-coe-spectacles-1924/almer-coe-prescription-card.webp',
        handoutType: 'report',
        nodeId: 'node-almer-coe-opticians',
        textContent:
          'ALMER COE & CO. OPTICIANS, 105 N. Wabash Ave., Chicago. Frame: Horn-Rimmed Tortoise, Patented X-Bridge Hinge (Lot 3 of 3). Client: Nathan F. Leopold Jr., 4754 Greenwood Ave. Special Note: Lenses ground from smoky Bohemian quartz, 19-deg prism.',
      },
      {
        slug: 'underwood-ransom-letter',
        title: 'The "George Johnson" Ransom Letter (Underwood Typeface)',
        image: '/handouts/almer-coe-spectacles-1924/underwood-ransom-letter.webp',
        handoutType: 'letter',
        nodeId: 'node-uchicago-archive',
        textContent:
          'Dear Sir: As you no doubt know by this time, your son has been kidnapped. Allow us to assure you that he is at present well and safe... [Forensic Note: Lowercase "t" tilts 4 degrees left; lowercase "m" shows chipped upper serif matching UChicago Seminar Portable #4].',
      },
      {
        slug: 'uchicago-hermetic-notes',
        title: 'Leopold’s Ornithological & Hermetic Field Journal',
        image: '/handouts/almer-coe-spectacles-1924/uchicago-hermetic-notes.webp',
        handoutType: 'diary',
        nodeId: 'node-uchicago-archive',
        textContent:
          'May 19, 1924 - Wolf Lake Culvert (41°40’N). Sighted Dendroica kirtlandii in the reeds. Margin Note in Latin: "De Voluntate Absoluta - He who strikes without hatred or pity steps outside the circle of mortal consequence. Site Alpha: Culvert. Site Omega: Calumet Boathouse."',
      },
      {
        slug: 'audio-crowe-interrogation-disc',
        title: 'Dictaphone Record: Chauffeur Englund & Leopold Inquest (May 1924)',
        image: '/handouts/almer-coe-spectacles-1924/almer-coe-prescription-card.webp',
        audioUrl: '/audio/handouts/almer-coe-spectacles-1924/crowe-interrogation-1924.mp3',
        handoutType: 'report',
        nodeId: 'node-leopold-mansion-garage',
        textContent:
          'State’s Attorney Dictaphone Cylinder (LaSalle Hotel, May 1924): Chauffeur Sven Englund confirms the family car never left the Kenwood garage, followed by Nathan Leopold’s icy voice explaining that an experiment in pure will requires no remorse.',
      },
    ],
  },

  // ==========================================================================
  // 3. 1983 (NOIR / COLD WAR) - THE CIRCLEVILLE LETTERS
  // ==========================================================================
  {
    id: 'circleville-letters-1983',
    title: 'Postmarked Columbus: The Circleville Letters',
    locale: 'en',
    era: 'noir',
    eraLabel: 'Cold War (1983)',
    yearRange: '1976-1983',
    activeSceneYear: 1983,
    startDate: '1983-02-18T19:00',
    initialWeather: 'Freezing Ohio rain and low static hum along the rural telephone lines',
    location: 'Circleville, Pickaway County, Ohio',
    country: 'USA',
    tone: 'noir',
    themes: [
      'Anonymous Block Letters',
      'Roadside Pistol Booby Trap',
      'Solitary Confinement Paradox',
      'Psychotronic Contagion',
    ],
    suggestedOccupations: [
      'County Deputy Sheriff',
      'Defense Attorney',
      'Investigative Reporter',
      'FBI Forensic Linguist',
    ],
    suggestedArchetypes: ['investigator', 'scholar', 'action', 'trickster'],
    hook: 'Paul Freshour is locked in solitary confinement for rigging a .25 pistol trap on a school bus route - yet the geometric anonymous letters keep arriving across Circleville and inside his locked cell.',
    description:
      'For seven years, the small town of Circleville, Ohio, has been terrorized by hundreds of anonymous letters written in rigid, geometric block capitals and postmarked from Columbus. After school bus driver Mary Gillespie discovers a roadside sign rigged to a box containing a loaded .25-caliber pistol, Sheriff Dwight Radcliff arrests her brother-in-law Paul Freshour and locks him in solitary confinement without pen or paper. Yet the geometric letters keep arriving across town - and inside Freshour’s locked cell. Worse, the fatal 1977 crash of Mary’s husband Ron Gillespie after a single gunshot points to a classified psychotronic carrier wave broadcasting from the town’s central water tower and telephone exchange.',
    investigatorIntro:
      'In February 1983, the residents of Circleville, Ohio, draw their curtains at dusk. Thousands of postmarked letters written in rigid, blocky capitals have exposed the town’s darkest secrets. When a loaded .25 pistol booby trap is found on Mary Gillespie’s school bus route, her brother-in-law Paul Freshour is locked in isolation - only for the letters to multiply overnight.',
    settingTrivia: [
      'Beginning in 1976, residents of Circleville, Ohio, received hundreds of anonymous letters postmarked from Columbus written in distinctive blocky capital letters.',
      'On August 19, 1977, Mary Gillespie’s husband Ron received a phone call from the alleged writer, drove off with his pistol, and died crashing into a tree after firing a single shot.',
      'Even after Paul Freshour was imprisoned in solitary confinement in 1983 for the bus-route pistol trap, letters continued to arrive in Circleville - including one addressed to Freshour in his cell.',
    ],
    estimatedSessions: '1-2',
    playerCount: '1-2',
    difficulty: 'normal',
    source: 'American Mythos Cold Cases',
    sourceCategory: 'oneshot',
    recommendedForBeginners: true,
    isStrefa11: true,
    isAmericanColdCase: true,
    documentType: 'scenario',
    isCampaign: false,
    activeNodeId: 'node-bus-route-trap',
    boundarySummary:
      'The operational zone encompasses Pickaway County (Circleville, the Westfall school bus route, Route 56 & Florence Chapel Pike, and the central water tower relay). Leaving the county before neutralizing the acoustic carrier wave allows the somnambulist contagion to trigger a town-wide night of paranoid violence.',
    truthAnchor: {
      culprit:
        'Dr. Harlan Vance (retired Battelle/MKUltra acoustic researcher operating out of the Westfall district archive) and his self-propagating cognitive-hypnotic protocol ("Project TOWN CRIER")',
      motive:
        'Using sub-audible frequency modulation injected into Pickaway County’s party-line telephone switches and hypnotic angular typography in the Columbus-postmarked letters, the experiment induces fugue states in townspeople - forcing ordinary residents (including Paul Freshour) to spy on neighbors, write new letters, and plant booby traps in their sleep without conscious memory.',
      murderWeapon:
        'Somnambulist fugue induction via 18.9 Hz telephone carrier tone and angular visual glyphs, causing Ron Gillespie’s 1977 fatal crash on Route 56 and rigging the .25-caliber box trap on the bus route.',
      keyAlibi:
        'Paul Freshour is locked under 24-hour guard in solitary confinement while letters in the exact same geometric hand continue to pass through the Columbus sorting facility.',
      immutableFacts: [
        'There are no extraterrestrial monsters in Circleville; the terror is a Cold War psychotronic and sociological contagion where the victims unknowingly become the "Circleville Writer" during nocturnal fugues.',
        'Ron Gillespie fired exactly one round from his pistol on the night of August 19, 1977, into the telephone junction box at Route 56 and Florence Chapel Pike before his truck hit the tree.',
        'The .25-caliber pistol in the bus-route booby trap belonged to Paul Freshour, who assembled the device in a hypnotic trance induced by a late-night telephone tone.',
        'Shutting down the low-frequency resonator inside the Circleville Water Tower & AT&T microwave relay breaks the hypnotic compulsion across Pickaway County.',
      ],
    },
    doomClock: {
      deadline: {
        year: 1983,
        month: 2,
        day: 19,
        hour: 23,
        minute: 59,
      },
      totalHours: 29,
      stages: [
        {
          phase: 0,
          title: 'Phase 0: Solitary Confinement Paradox',
          description:
            'Paul Freshour sits in a stripped cell, yet a freshly postmarked Columbus letter arrives under the Sheriff’s door. Residents watch each other through venetian blinds.',
        },
        {
          phase: 1,
          title: 'Phase 1: The Party-Line Hum',
          description:
            'Every rotary telephone in Circleville emits a faint rhythmic clicking at 11:00 PM. Sleepwalking residents are spotted near mailboxes.',
        },
        {
          phase: 2,
          title: 'Phase 2: Booby Traps on the Route',
          description:
            'New hand-painted signs appear along Route 56. Paranoia peaks as armed homeowners patrol their property lines in the fog.',
        },
        {
          phase: 3,
          title: 'Phase 3: Broadcast Saturation',
          description:
            'The water-tower relay reaches full amplitude. Half of Circleville enters a simultaneous somnambulist fugue to purge "the guilty".',
        },
      ],
    },
    secretsPool: [
      {
        id: 'sec-circleville-1',
        text: 'Microscopic ink analysis of the 1983 letters shows they were written by at least six different hands using identical geometric drafting stencils.',
        isDiscovered: false,
      },
      {
        id: 'sec-circleville-2',
        text: 'The bullet Ron Gillespie fired on August 19, 1977, is still lodged inside an illegal acoustic repeater box strapped to the utility pole at Route 56 and Florence Chapel Pike.',
        isDiscovered: false,
      },
      {
        id: 'sec-circleville-3',
        text: 'Paul Freshour has black ink stains under his fingernails from the night before his arrest that he genuinely cannot remember acquiring.',
        isDiscovered: false,
      },
      {
        id: 'sec-circleville-4',
        text: 'School Superintendent Gordon Massie authorized an acoustic "hearing-aid study" in the Westfall district in 1976 funded by a Columbus defense contractor.',
        isDiscovered: false,
      },
      {
        id: 'sec-circleville-5',
        text: 'Playing the 1977 cassette recording of Ron Gillespie’s last phone call through an oscilloscope reveals a dual-tone sub-harmonic pattern that triggers ocular migraines.',
        isDiscovered: false,
      },
      {
        id: 'sec-circleville-6',
        text: 'The central pumpkin-painted water tower in Circleville houses an unauthorized Bell Labs microwave dish aimed directly at the Westfall bus garage.',
        isDiscovered: false,
      },
    ],
    graph: {
      nodes: [
        {
          id: 'node-bus-route-trap',
          name: 'Westfall School Bus Route & The Fence-Post Trap',
          type: 'intro',
          description:
            'A lonely stretch of country road in Pickaway County flanked by winter cornfields and wooden fence posts. Yellow sheriff’s tape marks the spot where Mary Gillespie stopped her school bus to tear down an obscene sign - and found a loaded .25 pistol aimed at her chest.',
          atmosphere:
            'Cold wind rattling dry cornstalks, humming overhead telephone wires, and the eerie feeling of invisible binoculars watching from the tree line.',
          locationId: 'loc-bus-route-trap',
          npcIds: ['npc-mary-gillespie'],
          leadInClueIds: ['clue-sheriff-ballistics-log', 'clue-massie-blackmail-tapes'],
          leadOutClueIds: [
            'clue-booby-trap-diagram-pickaway',
            'clue-stencil-plastic-shaving',
            'clue-bus-route-pole-wire',
          ],
        },
        {
          id: 'node-pickaway-sheriff',
          name: 'Pickaway County Sheriff’s Office & Isolation Cell',
          type: 'location',
          isBottleneck: true,
          description:
            'Wood-paneled 1980s county law enforcement headquarters in downtown Circleville. Cardboard boxes overflow with hundreds of block-lettered anonymous envelopes, while Paul Freshour sits in a stripped solitary cell down the hall.',
          atmosphere:
            'Buzzing fluorescent tubes, ringing rotary phones, smell of stale coffee, and institutional paranoia.',
          secret:
            'Even with Paul Freshour under constant observation in solitary confinement, a freshly written block-letter envelope was slipped into the outgoing mail basket by a sleepwalking night deputy.',
          locationId: 'loc-pickaway-sheriff',
          npcIds: ['npc-sheriff-radcliff', 'npc-paul-freshour'],
          leadInClueIds: [
            'clue-booby-trap-diagram-pickaway',
            'clue-columbus-postmark-meter',
          ],
          leadOutClueIds: [
            'clue-circleville-block-letter-1983',
            'clue-freshour-hypnotic-testimony',
            'clue-sheriff-ballistics-log',
          ],
        },
        {
          id: 'node-route56-crash-site',
          name: 'Route 56 & Florence Chapel Pike (1977 Crash Site & Gillespie Home)',
          type: 'location',
          isBottleneck: true,
          description:
            'A scarred oak tree at the rural crossroads where Ron Gillespie’s pickup truck crashed on August 19, 1977, minutes after he received a phone call from "The Writer". Above the scarred bark, a rusted telephone junction box hangs from the utility pole.',
          atmosphere:
            'Headlights cutting through freezing mist, the crackle of high-tension lines, and unresolved grief.',
          secret:
            'Ron Gillespie was not drunk; he fired his pistol at the humming acoustic repeater box on the pole right before the sub-harmonic blast caused him to black out at the wheel.',
          locationId: 'loc-route56-crash-site',
          npcIds: ['npc-mary-gillespie'],
          leadInClueIds: [
            'clue-bus-route-pole-wire',
            'clue-circleville-block-letter-1983',
          ],
          leadOutClueIds: [
            'clue-coroner-report-ron-gillespie',
            'clue-audio-gillespie-1977-wiretap',
            'clue-pole-repeater-circuit',
          ],
        },
        {
          id: 'node-westfall-school-board',
          name: 'Westfall School District Archive & Superintendent’s Office',
          type: 'location',
          isBottleneck: true,
          description:
            'Brick administrative annex housing personnel records, mimeograph machines, drafting stencils, and the basement files of the 1976 acoustic research grant.',
          atmosphere:
            'Smell of purple mimeograph fluid, metal filing cabinets, and the click of a hidden tape recorder.',
          secret:
            'Dr. Harlan Vance used the school district’s phone tree and lettering stencils to seed "Project TOWN CRIER", turning dozens of citizens into unconscious letter-writers.',
          locationId: 'loc-westfall-school-board',
          npcIds: ['npc-gordon-massie', 'npc-harlan-vance'],
          leadInClueIds: [
            'clue-stencil-plastic-shaving',
            'clue-freshour-hypnotic-testimony',
            'clue-audio-gillespie-1977-wiretap',
          ],
          leadOutClueIds: [
            'clue-town-crier-project-file',
            'clue-massie-blackmail-tapes',
            'clue-columbus-postmark-meter',
          ],
        },
        {
          id: 'node-circleville-water-tower-climax',
          name: 'Circleville Water Tower & Underground AT&T Relay Bunker (Climax)',
          type: 'climax',
          isBottleneck: true,
          isClimax: true,
          description:
            'Beneath the towering orange-painted water tank looms a concrete Cold War telecommunications vault. Banks of reel-to-reel tape loops, frequency modulators, and drafting tables broadcast the 18.9 Hz somnambulist signal across every telephone line in Pickaway County.',
          atmosphere:
            'Deafening sub-bass resonance, spinning magnetic reels, and sleepwalking townspeople gathering outside the chain-link fence with weapons in hand.',
          secret:
            'Destroying the master tape loop and severing the water-tower coaxial trunk terminates the hypnotic signal and exposes Dr. Vance’s archive before the sleepwalkers open fire.',
          locationId: 'loc-circleville-water-tower',
          npcIds: ['npc-harlan-vance'],
          leadInClueIds: [
            'clue-coroner-report-ron-gillespie',
            'clue-pole-repeater-circuit',
            'clue-town-crier-project-file',
          ],
          leadOutClueIds: [],
        },
      ],
      clues: [
        {
          id: 'clue-booby-trap-diagram-pickaway',
          name: 'Forensic Diagram of the .25 Pistol Box Trap',
          description:
            'Crime-scene sketch from Mary Gillespie’s bus route showing a twine tripwire inside a wooden box holding a .25 automatic with a partially filed serial number traced to Paul Freshour.',
          sourceType: 'document',
          clueType: 'core',
          sourceNodeId: 'node-bus-route-trap',
          targetNodeId: 'node-pickaway-sheriff',
          requiredSkill: 'Spot Hidden',
        },
        {
          id: 'clue-stencil-plastic-shaving',
          name: 'Drafting-Stencil Shavings & School District Envelope',
          description:
            'Found in the weeds behind the bus-route fence: green celluloid shavings from an architectural lettering guide issued to the Westfall School Board.',
          sourceType: 'material',
          clueType: 'core',
          sourceNodeId: 'node-bus-route-trap',
          targetNodeId: 'node-westfall-school-board',
          requiredSkill: 'Track',
        },
        {
          id: 'clue-bus-route-pole-wire',
          name: 'Spliced Telephone Drop-Wire Along the Bus Route',
          description:
            'A black military-grade field wire running from the fence post up into the rural telephone trunk line heading toward the Route 56 intersection.',
          sourceType: 'material',
          clueType: 'core',
          sourceNodeId: 'node-bus-route-trap',
          targetNodeId: 'node-route56-crash-site',
          requiredSkill: 'Electrical Repair',
        },
        {
          id: 'clue-circleville-block-letter-1983',
          name: 'The Solitary Confinement Letter (Postmarked Columbus)',
          description:
            'A letter delivered to Paul Freshour inside his isolation cell while under 24-hour watch. The rigid geometric capitals match the 1977 letters sent to Ron Gillespie before his crash.',
          sourceType: 'document',
          clueType: 'core',
          sourceNodeId: 'node-pickaway-sheriff',
          targetNodeId: 'node-route56-crash-site',
          requiredSkill: 'Library Use',
        },
        {
          id: 'clue-freshour-hypnotic-testimony',
          name: 'Paul Freshour’s Polygraph & Fugue Transcript',
          description:
            'During questioning at the jail, Freshour recalls hearing a high-pitched chime on his kitchen telephone right before losing four hours of memory on the night the bus trap was set.',
          sourceType: 'testimony',
          clueType: 'core',
          sourceNodeId: 'node-pickaway-sheriff',
          targetNodeId: 'node-westfall-school-board',
          requiredSkill: 'Psychology',
        },
        {
          id: 'clue-sheriff-ballistics-log',
          name: 'Evidence Locker Comparison of the .25 Pistol',
          description:
            'Ballistics notes showing the string-pull angle on the bus-route box trap was calibrated using engineering graph paper from the Westfall district office.',
          sourceType: 'document',
          clueType: 'core',
          sourceNodeId: 'node-pickaway-sheriff',
          targetNodeId: 'node-bus-route-trap',
          requiredSkill: 'Law',
        },
        {
          id: 'clue-coroner-report-ron-gillespie',
          name: '1977 Crash Report & Spent .38 Casing at Route 56',
          description:
            'Coroner and deputy notes from August 19, 1977: Ron Gillespie’s blood alcohol was falsified in the summary, and his single gunshot struck a metal repeater box on the utility pole.',
          sourceType: 'document',
          clueType: 'core',
          sourceNodeId: 'node-route56-crash-site',
          targetNodeId: 'node-circleville-water-tower-climax',
          requiredSkill: 'Spot Hidden',
        },
        {
          id: 'clue-audio-gillespie-1977-wiretap',
          name: 'Cassette Tape of Ron Gillespie’s Last Phone Call (1977)',
          description:
            'Hidden in the Gillespie attic: a micro-cassette recording of the anonymous caller whose voice rides a hypnotic 18.9 Hz carrier wave traced to the Westfall administrative switchboard.',
          sourceType: 'material',
          clueType: 'core',
          sourceNodeId: 'node-route56-crash-site',
          targetNodeId: 'node-westfall-school-board',
          requiredSkill: 'Listen',
        },
        {
          id: 'clue-pole-repeater-circuit',
          name: 'Bullet-Damaged Acoustic Repeater on Route 56',
          description:
            'Prying open the rusted utility box above Ron’s crash site reveals a custom frequency modulator stamped with the coordinates of the central Circleville Water Tower.',
          sourceType: 'material',
          clueType: 'core',
          sourceNodeId: 'node-route56-crash-site',
          targetNodeId: 'node-circleville-water-tower-climax',
          requiredSkill: 'Electrical Repair',
        },
        {
          id: 'clue-town-crier-project-file',
          name: 'Classified "Project TOWN CRIER" Psychotronic Ledger',
          description:
            'Locked in the basement archive of the Westfall school board: Dr. Harlan Vance’s sociological matrix tracking every letter recipient and routing master broadcasts through the Circleville Water Tower.',
          sourceType: 'document',
          clueType: 'core',
          sourceNodeId: 'node-westfall-school-board',
          targetNodeId: 'node-circleville-water-tower-climax',
          requiredSkill: 'Library Use',
        },
        {
          id: 'clue-massie-blackmail-tapes',
          name: 'Superintendent Gordon Massie’s Dictaphone Tapes',
          description:
            'Confession recording admitting that the 1976 "hearing study" wired the school bus garage and Mary Gillespie’s route into the acoustic monitoring grid.',
          sourceType: 'testimony',
          clueType: 'core',
          sourceNodeId: 'node-westfall-school-board',
          targetNodeId: 'node-bus-route-trap',
          requiredSkill: 'Persuade',
        },
        {
          id: 'clue-columbus-postmark-meter',
          name: 'Pitney Bowes Postage Meter Die #OH-43215',
          description:
            'Found in the Westfall supply closet: a Columbus-registered postage stamping die used to postmark batches of letters mailed by sleepwalking residents.',
          sourceType: 'material',
          clueType: 'core',
          sourceNodeId: 'node-westfall-school-board',
          targetNodeId: 'node-pickaway-sheriff',
          requiredSkill: 'Spot Hidden',
        },
      ],
      connections: [
        {
          fromId: 'node-bus-route-trap',
          toId: 'node-pickaway-sheriff',
          clueId: 'clue-booby-trap-diagram-pickaway',
          description:
            'The .25 pistol recovered from the roadside box trap traces directly to the Sheriff’s evidence locker and Paul Freshour’s cell.',
        },
        {
          fromId: 'node-bus-route-trap',
          toId: 'node-westfall-school-board',
          clueId: 'clue-stencil-plastic-shaving',
          description:
            'Green lettering-stencil shavings behind the fence post match supplies at the Westfall School Board.',
        },
        {
          fromId: 'node-bus-route-trap',
          toId: 'node-route56-crash-site',
          clueId: 'clue-bus-route-pole-wire',
          description:
            'The spliced field wire follows the utility poles directly to the Route 56 crash intersection.',
        },
        {
          fromId: 'node-pickaway-sheriff',
          toId: 'node-route56-crash-site',
          clueId: 'clue-circleville-block-letter-1983',
          description:
            'The letter sent to Freshour in solitary references the truth behind Ron Gillespie’s 1977 crash on Route 56.',
        },
        {
          fromId: 'node-pickaway-sheriff',
          toId: 'node-westfall-school-board',
          clueId: 'clue-freshour-hypnotic-testimony',
          description:
            'Freshour’s memory gap and phone-chime testimony point to the Westfall acoustic study.',
        },
        {
          fromId: 'node-pickaway-sheriff',
          toId: 'node-bus-route-trap',
          clueId: 'clue-sheriff-ballistics-log',
          description:
            'Ballistics notes send investigators back to examine the exact tripwire geometry at the bus route.',
        },
        {
          fromId: 'node-route56-crash-site',
          toId: 'node-circleville-water-tower-climax',
          clueId: 'clue-coroner-report-ron-gillespie',
          description:
            'The trajectory of Ron Gillespie’s gunshot points to the relay network connected to the Water Tower.',
        },
        {
          fromId: 'node-route56-crash-site',
          toId: 'node-westfall-school-board',
          clueId: 'clue-audio-gillespie-1977-wiretap',
          description:
            'The 1977 phone recording traces the caller’s carrier wave to the Westfall switchboard.',
        },
        {
          fromId: 'node-route56-crash-site',
          toId: 'node-circleville-water-tower-climax',
          clueId: 'clue-pole-repeater-circuit',
          description:
            'The bullet-damaged repeater box on the utility pole is hardwired to the Circleville Water Tower bunker.',
        },
        {
          fromId: 'node-westfall-school-board',
          toId: 'node-circleville-water-tower-climax',
          clueId: 'clue-town-crier-project-file',
          description:
            'Project TOWN CRIER schematics identify the underground AT&T bunker beneath the Water Tower as the master transmitter.',
        },
        {
          fromId: 'node-westfall-school-board',
          toId: 'node-bus-route-trap',
          clueId: 'clue-massie-blackmail-tapes',
          description:
            'Massie’s dictaphone tapes reveal how Mary Gillespie’s bus route was wired into the experiment.',
        },
        {
          fromId: 'node-westfall-school-board',
          toId: 'node-pickaway-sheriff',
          clueId: 'clue-columbus-postmark-meter',
          description:
            'The fake Columbus postage meter die explains how letters reached the Sheriff’s office overnight.',
        },
      ],
      npcs: [
        {
          id: 'npc-mary-gillespie',
          name: 'Mary Gillespie',
          description:
            'Exhausted but defiant Westfall school bus driver who has endured seven years of anonymous stalking and the death of her husband.',
          secret:
            'Keeps a shoebox of unreported letters and Ron’s 1977 cassette tape hidden in her attic.',
        },
        {
          id: 'npc-paul-freshour',
          name: 'Paul Freshour',
          description:
            'Mary’s brother-in-law, currently locked in solitary confinement after his .25 pistol was found in the roadside trap.',
          secret:
            'Terrified because he cannot remember anything between 11:00 PM and 3:00 AM on the night the trap was planted.',
        },
        {
          id: 'npc-sheriff-radcliff',
          name: 'Sheriff Dwight Radcliff',
          description:
            'Long-serving Pickaway County Sheriff determined to close the case, yet shaken by the letters still arriving while Freshour is in chains.',
          secret:
            'Received a block-lettered note on his own desk this morning describing a conversation he had alone in his kitchen.',
        },
        {
          id: 'npc-gordon-massie',
          name: 'Gordon Massie (School Superintendent)',
          description:
            'Nervous Westfall administrator whose alleged affair with Mary Gillespie was the original subject of the 1976 letters.',
          secret:
            'Signed off on Dr. Vance’s acoustic telephone line installation in 1976 in exchange for hush money.',
        },
        {
          id: 'npc-harlan-vance',
          name: 'Dr. Harlan Vance',
          description:
            'Mild-mannered acoustic contractor and former Cold War behavioral researcher running Project TOWN CRIER.',
          secret:
            'Uses the Circleville Water Tower relay to turn the entire town into a self-policing panopticon of sleepwalking informants.',
        },
      ],
      locations: [
        {
          id: 'loc-bus-route-trap',
          name: 'Westfall Bus Route Fence Post',
          description:
            'Rural Ohio roadside where the .25 pistol booby trap was rigged to an obscene sign.',
          atmosphere:
            'Bleak winter fields, fluttering police tape, and humming telephone wires.',
        },
        {
          id: 'loc-pickaway-sheriff',
          name: 'Pickaway County Sheriff’s Office & Jail',
          description:
            'County headquarters in Circleville holding the evidence boxes and Paul Freshour’s isolation cell.',
          atmosphere:
            'Fluorescent glare, clanging cell bars, and stacks of Columbus-postmarked mail.',
        },
        {
          id: 'loc-route56-crash-site',
          name: 'Route 56 & Florence Chapel Pike',
          description:
            'Rural intersection where Ron Gillespie died in 1977 after firing a single shot from his pistol.',
          atmosphere: 'Scarred oak tree, rusted utility box, and cold highway fog.',
        },
        {
          id: 'loc-westfall-school-board',
          name: 'Westfall School District Administration',
          description:
            'Administrative offices and basement archives of the local school district.',
          atmosphere: 'Mimeograph ink, locked steel cabinets, and acoustic test charts.',
        },
        {
          id: 'loc-circleville-water-tower',
          name: 'Circleville Water Tower & AT&T Relay Bunker',
          description:
            'Landmark water tower concealing an underground Cold War telecommunications relay.',
          atmosphere:
            'Sub-audible 18.9 Hz vibration, spinning tape loops, and high-voltage transformers.',
        },
      ],
    },
    externalLinks: [
      {
        label: 'Wikipedia (Circleville Letter Writer)',
        url: 'https://en.wikipedia.org/wiki/Circleville_lettter_writer',
      },
      {
        label: 'Unsolved Mysteries Archive (Circleville Letters)',
        url: 'https://unsolved.com/gallery/circleville-writer/',
      },
    ],
    handouts: [
      {
        slug: 'circleville-block-letter-1983',
        title: 'The Solitary Confinement Letter (Postmarked Columbus, 1983)',
        image: '/handouts/circleville-letters-1983/circleville-block-letter-1983.webp',
        handoutType: 'letter',
        nodeId: 'node-pickaway-sheriff',
        textContent:
          'POSTMARK: COLUMBUS, OH - FEB 1983. "FRESHOUR DO YOU REALLY BELIEVE WALLS CAN STOP THE EYES THAT WATCH PICKAWAY COUNTY? YOU BUILT THE BOX ON THE BUS ROUTE WHEN THE BELL RANG. SOON EVERYONE IN CIRCLEVILLE WILL ANSWER THE TONE."',
      },
      {
        slug: 'booby-trap-diagram-pickaway',
        title: 'Sheriff’s Exhibit A: Bus-Route .25 Pistol Booby Trap Diagram',
        image: '/handouts/circleville-letters-1983/booby-trap-diagram-pickaway.webp',
        handoutType: 'report',
        nodeId: 'node-bus-route-trap',
        textContent:
          'PICKAWAY COUNTY SHERIFF EVIDENCE SKETCH (Feb 1983): Roadside wooden sign wired via twine to concealed pine box. Weapon: .25 ACP semi-automatic pistol, serial partially filed, barrel aligned at chest height (54 inches). Secondary wire spliced into Bell telephone pole #114.',
      },
      {
        slug: 'coroner-report-ron-gillespie',
        title: '1977 Inquest Addendum: Death of Ronald Gillespie (Route 56)',
        image: '/handouts/circleville-letters-1983/coroner-report-ron-gillespie.webp',
        handoutType: 'report',
        nodeId: 'node-route56-crash-site',
        textContent:
          'SUPPLEMENTAL REPORT (Aug 19, 1977 - Route 56 & Florence Chapel Pike): Decedent left residence at 23:14 after phone call. Pickup struck oak tree at 55 mph. Weapon (.38 revolver) recovered on floorboard with ONE (1) spent casing. Bullet hole located 18 feet up utility pole in acoustic junction box.',
      },
      {
        slug: 'audio-gillespie-1977-wiretap',
        title: 'Micro-Cassette Recording: Ron Gillespie’s Last Phone Call (Aug 19, 1977)',
        image: '/handouts/circleville-letters-1983/coroner-report-ron-gillespie.webp',
        audioUrl: '/audio/handouts/circleville-letters-1983/gillespie-wiretap-1977.mp3',
        handoutType: 'report',
        nodeId: 'node-route56-crash-site',
        textContent:
          'Home tape recording from August 19, 1977: rotary dial clicks, a deep 18.9 Hz electronic hum on the party line, and a clipped, rhythmic voice reciting the exact movements inside the Gillespie kitchen before telling Ron to meet at Route 56.',
      },
    ],
  },

  // ==========================================================================
  // 4. 2005 (MODERN) - TODD GEIB & THE OVIDHALL LAKE ANOMALY
  // ==========================================================================
  {
    id: 'ovidhall-lake-anomaly-2005',
    title: 'I’m in a Field: The Ovidhall Lake Anomaly',
    locale: 'en',
    era: 'modern',
    eraLabel: 'Modern Era (2005)',
    yearRange: '2005',
    activeSceneYear: 2005,
    startDate: '2005-07-03T18:00',
    initialWeather: 'Oppressive 90-degree Michigan summer heat and thick cicada drone over the bogs',
    location: 'Casnovia & Muskegon County, Michigan',
    country: 'USA',
    tone: 'purist',
    themes: [
      'Vertical Body in the Lake',
      '21-Day Missing Time',
      'Dry Drowning Autopsy',
      'Smiley Face Murders & Gla’aki',
    ],
    suggestedOccupations: [
      'Homicide Detective',
      'Forensic Pathologist',
      'Relative / Local Searcher',
      'State Police Investigator',
    ],
    suggestedArchetypes: ['investigator', 'healer', 'action', 'scholar'],
    hook: 'Three weeks after vanishing during a 12:51 AM phone call ("I’m in a field"), 22-year-old Todd Geib is found standing vertically in a previously searched Michigan pond - with zero water in his lungs and zero decomposition.',
    description:
      'Twenty-one days after 22-year-old Todd Geib vanished from a bonfire party in a Casnovia apple orchard following a disoriented 12:51 AM cell phone call ("I’m in a field"), his body suddenly appears in Ovidhall Lake - a kettle pond already searched three times by sonar and scent dogs. His corpse is found floating straight upright, head and shoulders protruding above the water like a pale buoy. Autopsy reveals zero water in his lungs, unknown tricyclic compounds in his blood, and tissue preservation proving he died less than 48 hours ago. Beneath the glacial kettle lakes of Michigan, a subterranean colony of Gla’aki and its undying Smiley-Face initiates are harvesting living hosts.',
    investigatorIntro:
      'On July 2, 2005, searchers in rural Casnovia, Michigan, make a discovery that defies forensic science: 22-year-old Todd Geib, missing since a June 11 orchard bonfire, is found floating straight upright in Ovidhall Lake - a pond already swept multiple times by divers and tracking dogs. Despite 21 days of blistering summer heat, his body is untouched by decay, and his lungs are completely dry.',
    settingTrivia: [
      'On June 12, 2005, at 12:51 AM, Todd Geib made his final cell phone call after leaving a bonfire in Casnovia, Michigan, saying only "I’m in a field" before wind static cut the line.',
      'When his body was discovered 21 days later in Ovidhall Lake on July 2, 2005, witnesses reported it was positioned vertically in the water with head and shoulders above the surface.',
      'Retired NYPD detectives Kevin Gannon and Anthony Duarte investigated the case as part of the "Smiley Face Murder" pattern across the Great Lakes states.',
    ],
    estimatedSessions: '1-2',
    playerCount: '1-2',
    difficulty: 'hard',
    source: 'American Mythos Cold Cases',
    sourceCategory: 'oneshot',
    recommendedForBeginners: true,
    isStrefa11: true,
    isAmericanColdCase: true,
    documentType: 'scenario',
    isCampaign: false,
    activeNodeId: 'node-ovidhall-lake-shore',
    boundarySummary:
      'The investigation covers rural Casnovia, Ravenna (Half Moon Bar & Grille), the Muskegon forensic laboratory, and the Ovidhall Lake bog basin. Leaving the county before collapsing the flooded glacial sinkhole allows the orchard initiates to claim the next three youths marked at the bonfire.',
    truthAnchor: {
      culprit:
        'The Great Lakes Covenant of Gla’aki (operating as the "Smiley Face" network) and the subterranean spined entity slumbering in the flooded karst beneath Ovidhall Lake',
      motive:
        'Victims lured from rural bonfires and bars are injected with Gla’aki’s neurotoxic spine-fluid (which registers on hospital gas-chromatography as tricyclic antidepressants) to hold them in metabolic stasis for 21 days in an air-filled subterranean cenote before returning them upright to the surface as resonant beacons.',
      murderWeapon:
        'Dry asphyxiation and metabolic stasis induced by Gla’aki spine-ichor, leaving zero lake water or diatoms in the lungs.',
      keyAlibi:
        'Local authorities classify the death as an accidental drowning on the night of June 12, ignoring the impossibility of an un-decomposed body floating vertically after three weeks of 90-degree summer heat.',
      immutableFacts: [
        'Todd Geib was alive in a subterranean glacial pocket beneath the orchard between June 12 and June 30, 2005, which is why scent dogs and sonar searches of Ovidhall Lake found nothing for 20 days.',
        'The upright vertical posture of the body in Ovidhall Lake is caused by crystalline metallic salts crystallizing in the lower spine from Gla’aki’s fluid.',
        'Zero water or pond diatoms exist in the victim’s alveoli ("dry drowning"), proving death occurred in an air-filled chamber before immersion.',
        'A fluorescent yellow "Smiley Face" painted on the concrete culvert at Ovidhall Lake marks the submerged limestone intake leading to the stasis chamber.',
      ],
    },
    doomClock: {
      deadline: {
        year: 2005,
        month: 7,
        day: 4,
        hour: 23,
        minute: 59,
      },
      totalHours: 30,
      stages: [
        {
          phase: 0,
          title: 'Phase 0: The Upright Buoy',
          description:
            'Police tape surrounds Ovidhall Lake. County officials push to close the file as an accidental drowning before the Fourth of July holiday.',
        },
        {
          phase: 1,
          title: 'Phase 1: Dead-Zone Interference',
          description:
            'Cell phones near the Casnovia orchard receive delayed 3-week-old voice packets from the night of June 12. The water level in the kettle pond drops six inches.',
        },
        {
          phase: 2,
          title: 'Phase 2: The Second Bonfire',
          description:
            'White panel vans bearing out-of-state plates are spotted near the Half Moon Bar. Pale figures with pinprick scars at the base of the neck patrol the orchard.',
        },
        {
          phase: 3,
          title: 'Phase 3: The Spines Rise in Ovidhall',
          description:
            'The glacial sinkhole beneath Ovidhall Lake opens completely. Metallic spines breach the reed beds as the entity draws the whole bog downward.',
        },
      ],
    },
    secretsPool: [
      {
        id: 'sec-ovidhall-1',
        text: 'Forensic entomology and vitreous potassium levels prove Todd Geib’s heart stopped no earlier than June 30 - eighteen days after his last phone call.',
        isDiscovered: false,
      },
      {
        id: 'sec-ovidhall-2',
        text: 'The "antidepressant" peak on the Muskegon toxicology chromatograph is actually an organic organometallic alkaloid secreted by subterranean lake organisms.',
        isDiscovered: false,
      },
      {
        id: 'sec-ovidhall-3',
        text: 'Cell-tower triangulation from 12:51 AM on June 12 shows Todd’s Nokia phone transmitted from 40 feet BELOW the elevation of the Casnovia apple orchard.',
        isDiscovered: false,
      },
      {
        id: 'sec-ovidhall-4',
        text: 'The yellow Smiley Face graffiti found at Ovidhall Lake is mixed with crushed freshwater mussel nacre that glows under ultraviolet crime-scene lamps.',
        isDiscovered: false,
      },
      {
        id: 'sec-ovidhall-5',
        text: 'A 19th-century Michigan geological survey at the hydrology station shows Ovidhall Lake and the orchard are connected by a flooded limestone karst tube.',
        isDiscovered: false,
      },
      {
        id: 'sec-ovidhall-6',
        text: 'Beneath Todd’s fingernails are traces of blind cave-crustacean chitin found only in sealed subterranean aquifers.',
        isDiscovered: false,
      },
    ],
    graph: {
      nodes: [
        {
          id: 'node-ovidhall-lake-shore',
          name: 'Ovidhall Lake Shore & The Smiley-Face Weir',
          type: 'intro',
          description:
            'A secluded, reed-choked kettle pond surrounded by boggy woods in rural Casnovia. Yellow crime-scene tape flutters where volunteers found Todd Geib’s body standing straight upright in the dark water twenty-one days after he vanished.',
          atmosphere:
            'Buzzing mosquitoes, stagnant peat smell, unnaturally cold ripples at the center of the pond, and a painted yellow Smiley Face staring from the concrete weir.',
          locationId: 'loc-ovidhall-lake-shore',
          npcIds: ['npc-kevin-gannon', 'npc-mark-heller'],
          leadInClueIds: [
            'clue-audio-voicemail-in-a-field',
            'clue-bartender-smiley-coaster',
          ],
          leadOutClueIds: [
            'clue-photo-ovidhall-smiley-graffiti',
            'clue-sonar-search-grid-log',
            'clue-karst-sinkhole-current',
          ],
        },
        {
          id: 'node-muskegon-morgue',
          name: 'Muskegon County Forensic Pathology Lab',
          type: 'location',
          isBottleneck: true,
          description:
            'Stainless-steel autopsy suite and gas-chromatography laboratory. Under harsh surgical lights, the forensic evidence defies every textbook on freshwater drowning.',
          atmosphere:
            'Hum of refrigeration units, smell of formalin, and the unsettling stillness of a body that refuses to decay.',
          secret:
            'The lungs are bone-dry, the lower spine is magnetized by crystalline needles, and the blood contains an unknown organometallic stasis compound.',
          locationId: 'loc-muskegon-morgue',
          npcIds: ['npc-alan-mercer'],
          leadInClueIds: [
            'clue-sonar-search-grid-log',
            'clue-medical-waste-manifest',
          ],
          leadOutClueIds: [
            'clue-autopsy-toxicology-muskegon',
            'clue-blind-crustacean-chitin',
            'clue-toxicology-bar-receipt',
          ],
        },
        {
          id: 'node-casnovia-orchard',
          name: 'Casnovia Apple Orchard & The 12:51 AM Field',
          type: 'location',
          isBottleneck: true,
          description:
            'Gnarled rows of apple trees giving way to waist-high marsh grass and the charred remains of the June 11 bonfire. Half-hidden in the weeds stands a rusted iron grate covering an old glacial sinkhole.',
          atmosphere:
            'Flickering cell phone bars, static hissing from speakers, and a cold draft rising from the earth beneath the grass.',
          secret:
            'Todd did not wander into a random field; at 12:51 AM he was already descending into the sunken limestone pasture beneath the orchard.',
          locationId: 'loc-casnovia-orchard',
          npcIds: ['npc-tyler-vance'],
          leadInClueIds: [
            'clue-photo-ovidhall-smiley-graffiti',
            'clue-blind-crustacean-chitin',
          ],
          leadOutClueIds: [
            'clue-gsm-tower-triangulation-log',
            'clue-audio-voicemail-in-a-field',
            'clue-bonfire-fight-witness',
          ],
        },
        {
          id: 'node-half-moon-bar',
          name: 'Half Moon Bar & Grille / Ravenna Hydrology Station',
          type: 'location',
          isBottleneck: true,
          description:
            'A neon-lit rural Michigan roadhouse where Todd spent his last evening before the bonfire, adjacent to the county watershed monitoring office.',
          atmosphere:
            'Neon beer signs, jukebox hum, and faded geological survey maps of Michigan’s kettle lakes.',
          secret:
            'Members of the Great Lakes Covenant use the roadhouse to scout young men and dose them with diluted Gla’aki ichor before guiding them to the orchard sinkhole.',
          locationId: 'loc-half-moon-bar',
          npcIds: ['npc-cole-holloway'],
          leadInClueIds: [
            'clue-karst-sinkhole-current',
            'clue-toxicology-bar-receipt',
            'clue-bonfire-fight-witness',
          ],
          leadOutClueIds: [
            'clue-glacial-karst-survey-map',
            'clue-bartender-smiley-coaster',
            'clue-medical-waste-manifest',
          ],
        },
        {
          id: 'node-subterranean-cenote-climax',
          name: 'The Subterranean Cenote Beneath Ovidhall Lake (Climax)',
          type: 'climax',
          isBottleneck: true,
          isClimax: true,
          description:
            'An air-filled limestone cavern forty feet beneath the orchard and Ovidhall Lake. Bioluminescent green mold coats the stalactites above a black subterranean pool where metallic spines jut from the water and pale initiates tend cocooned victims in timeless stasis.',
          atmosphere:
            'Dripping mineral water, hypnotic telepathic pulsing, and the terrifying realization of an ancient organism slumbering beneath the Great Lakes.',
          secret:
            'Detonating the orchard irrigation fuel tanks or collapsing the limestone sluice gate seals the cenote and severs the Smiley-Face initiates from Gla’aki’s brood.',
          locationId: 'loc-subterranean-cenote',
          npcIds: ['npc-cole-holloway', 'npc-glaaki-brood'],
          leadInClueIds: [
            'clue-autopsy-toxicology-muskegon',
            'clue-gsm-tower-triangulation-log',
            'clue-glacial-karst-survey-map',
          ],
          leadOutClueIds: [],
        },
      ],
      clues: [
        {
          id: 'clue-photo-ovidhall-smiley-graffiti',
          name: 'UV Crime-Scene Photo of the Smiley Face & Upright Recovery',
          description:
            'Photograph taken on the bank of Ovidhall Lake showing the body floating vertically from the chest up, and a freshly painted yellow Smiley Face on the drainage weir pointing toward the orchard.',
          sourceType: 'document',
          clueType: 'core',
          sourceNodeId: 'node-ovidhall-lake-shore',
          targetNodeId: 'node-casnovia-orchard',
          requiredSkill: 'Spot Hidden',
        },
        {
          id: 'clue-sonar-search-grid-log',
          name: 'Search-and-Rescue Dive & K9 Grid Maps (June 13-28)',
          description:
            'Official Michigan State Police search logs proving dive teams and cadaver dogs swept Ovidhall Lake three separate times with zero hits before July 2, cross-referenced with the Muskegon morgue intake.',
          sourceType: 'document',
          clueType: 'core',
          sourceNodeId: 'node-ovidhall-lake-shore',
          targetNodeId: 'node-muskegon-morgue',
          requiredSkill: 'Navigate',
        },
        {
          id: 'clue-karst-sinkhole-current',
          name: 'Submerged Limestone Vortex & Mussel Shell Trail',
          description:
            'At the center of the kettle pond, a cold upward thermal current vents from a submerged limestone shaft mapped at the Ravenna hydrology station.',
          sourceType: 'anomaly',
          clueType: 'core',
          sourceNodeId: 'node-ovidhall-lake-shore',
          targetNodeId: 'node-half-moon-bar',
          requiredSkill: 'Science (Geology / Biology)',
        },
        {
          id: 'clue-autopsy-toxicology-muskegon',
          name: 'Muskegon Autopsy & Gas-Chromatography Report',
          description:
            'Pathology file: zero lake water in the lungs, post-mortem interval of only 48 hours despite 21 days missing, and a puncture mark over the third vertebra filled with metallic spinal fluid.',
          sourceType: 'document',
          clueType: 'core',
          sourceNodeId: 'node-muskegon-morgue',
          targetNodeId: 'node-subterranean-cenote-climax',
          requiredSkill: 'Medicine',
        },
        {
          id: 'clue-blind-crustacean-chitin',
          name: 'Subterranean Cave-Shrimp Chitin Under Fingernails',
          description:
            'Microscopic scrapings from the victim’s hands match blind troglobitic amphipods native to the flooded karst caves beneath the Casnovia orchard.',
          sourceType: 'material',
          clueType: 'core',
          sourceNodeId: 'node-muskegon-morgue',
          targetNodeId: 'node-casnovia-orchard',
          requiredSkill: 'Science (Biology)',
        },
        {
          id: 'clue-toxicology-bar-receipt',
          name: 'Stomach Contents & Half Moon Bar Timestamped Tab',
          description:
            'Undigested food from the night of June 11 proves metabolism was frozen less than an hour after leaving the Half Moon Bar & Grille.',
          sourceType: 'document',
          clueType: 'core',
          sourceNodeId: 'node-muskegon-morgue',
          targetNodeId: 'node-half-moon-bar',
          requiredSkill: 'Library Use',
        },
        {
          id: 'clue-gsm-tower-triangulation-log',
          name: 'Cingular GSM Tower Triangulation Log (00:47 - 00:57 AM)',
          description:
            'Engineering printout showing Todd’s phone signal dropped 40 feet underground in the middle of the orchard field at 12:51 AM right above a collapsed well shaft.',
          sourceType: 'document',
          clueType: 'core',
          sourceNodeId: 'node-casnovia-orchard',
          targetNodeId: 'node-subterranean-cenote-climax',
          requiredSkill: 'Electrical Repair',
        },
        {
          id: 'clue-audio-voicemail-in-a-field',
          name: 'Recovered Voicemail Audio: "I’m in a Field" (12:51 AM)',
          description:
            'Digital audio file from June 12: Todd’s disoriented voice saying "I’m in a field", followed by the rhythmic metallic clanking of an old orchard irrigation pump house.',
          sourceType: 'material',
          clueType: 'core',
          sourceNodeId: 'node-casnovia-orchard',
          targetNodeId: 'node-ovidhall-lake-shore',
          requiredSkill: 'Listen',
        },
        {
          id: 'clue-bonfire-fight-witness',
          name: 'Bonfire Witness Statement on the White Panel Van',
          description:
            'A partygoer admits seeing two pale men in utility jackets offer Todd a ride near the orchard road after a fight broke out at 12:45 AM, heading toward Ravenna.',
          sourceType: 'testimony',
          clueType: 'core',
          sourceNodeId: 'node-casnovia-orchard',
          targetNodeId: 'node-half-moon-bar',
          requiredSkill: 'Persuade',
        },
        {
          id: 'clue-glacial-karst-survey-map',
          name: '1898 Glacial Karst & Cenote Survey of Muskegon County',
          description:
            'Archived at the Ravenna station: a hydrologist’s map showing an air-filled subterranean cenote directly connecting the orchard sinkhole to the bottom of Ovidhall Lake.',
          sourceType: 'document',
          clueType: 'core',
          sourceNodeId: 'node-half-moon-bar',
          targetNodeId: 'node-subterranean-cenote-climax',
          requiredSkill: 'Navigate',
        },
        {
          id: 'clue-bartender-smiley-coaster',
          name: 'Surveillance Tape & Smiley-Face Bar Coaster',
          description:
            'CCTV from Half Moon Bar on June 11 shows a stranger slipping a clear vial into a drink and leaving a coaster marked with the exact UV Smiley glyph found at Ovidhall Lake.',
          sourceType: 'material',
          clueType: 'core',
          sourceNodeId: 'node-half-moon-bar',
          targetNodeId: 'node-ovidhall-lake-shore',
          requiredSkill: 'Spot Hidden',
        },
        {
          id: 'clue-medical-waste-manifest',
          name: 'Stolen Veterinary Ketamine & Lab Log',
          description:
            'A discarded vial behind the bar’s dumpster links the paralytic agent to the toxicology anomalies analyzed at the Muskegon morgue.',
          sourceType: 'material',
          clueType: 'core',
          sourceNodeId: 'node-half-moon-bar',
          targetNodeId: 'node-muskegon-morgue',
          requiredSkill: 'Medicine',
        },
      ],
      connections: [
        {
          fromId: 'node-ovidhall-lake-shore',
          toId: 'node-casnovia-orchard',
          clueId: 'clue-photo-ovidhall-smiley-graffiti',
          description:
            'The UV Smiley Face glyph on the lake weir points along a beaten path straight into the Casnovia apple orchard.',
        },
        {
          fromId: 'node-ovidhall-lake-shore',
          toId: 'node-muskegon-morgue',
          clueId: 'clue-sonar-search-grid-log',
          description:
            'The impossibility of the 21-day search logs demands an immediate examination of the body at the Muskegon morgue.',
        },
        {
          fromId: 'node-ovidhall-lake-shore',
          toId: 'node-half-moon-bar',
          clueId: 'clue-karst-sinkhole-current',
          description:
            'Thermal currents in the pond lead investigators to the watershed records at Ravenna / Half Moon Bar.',
        },
        {
          fromId: 'node-muskegon-morgue',
          toId: 'node-subterranean-cenote-climax',
          clueId: 'clue-autopsy-toxicology-muskegon',
          description:
            'Dry lungs and crystalline spinal fluid prove the victim was held in an air-filled subterranean chamber beneath the lake.',
        },
        {
          fromId: 'node-muskegon-morgue',
          toId: 'node-casnovia-orchard',
          clueId: 'clue-blind-crustacean-chitin',
          description:
            'Cave-crustacean traces under the fingernails lead to the karst sinkhole in the Casnovia orchard.',
        },
        {
          fromId: 'node-muskegon-morgue',
          toId: 'node-half-moon-bar',
          clueId: 'clue-toxicology-bar-receipt',
          description:
            'Undigested stomach contents and a bar receipt trace Todd’s last hours back to Half Moon Bar & Grille.',
        },
        {
          fromId: 'node-casnovia-orchard',
          toId: 'node-subterranean-cenote-climax',
          clueId: 'clue-gsm-tower-triangulation-log',
          description:
            'GSM triangulation places the 12:51 AM call forty feet underground inside the flooded cenote.',
        },
        {
          fromId: 'node-casnovia-orchard',
          toId: 'node-ovidhall-lake-shore',
          clueId: 'clue-audio-voicemail-in-a-field',
          description:
            'Background pump acoustics on the 12:51 AM voicemail lead back to the Ovidhall Lake weir.',
        },
        {
          fromId: 'node-casnovia-orchard',
          toId: 'node-half-moon-bar',
          clueId: 'clue-bonfire-fight-witness',
          description:
            'Witnesses at the bonfire saw the white van heading toward the Ravenna roadhouse.',
        },
        {
          fromId: 'node-half-moon-bar',
          toId: 'node-subterranean-cenote-climax',
          clueId: 'clue-glacial-karst-survey-map',
          description:
            'The 1898 geological survey reveals the submerged limestone tube entering the cenote beneath Ovidhall Lake.',
        },
        {
          fromId: 'node-half-moon-bar',
          toId: 'node-ovidhall-lake-shore',
          clueId: 'clue-bartender-smiley-coaster',
          description:
            'The UV-reactive Smiley coaster links the roadhouse suspect directly to the Ovidhall Lake shore.',
        },
        {
          fromId: 'node-half-moon-bar',
          toId: 'node-muskegon-morgue',
          clueId: 'clue-medical-waste-manifest',
          description:
            'Recovered vials behind the bar match the unidentified tricyclic peak in the Muskegon autopsy.',
        },
      ],
      npcs: [
        {
          id: 'npc-kevin-gannon',
          name: 'Det. Kevin Gannon (NYPD Ret.)',
          description:
            'Veteran homicide detective investigating a nationwide pattern of young men found in bodies of water near Smiley Face graffiti.',
          secret:
            'Possesses case files from Michigan, Wisconsin, and Iowa showing identical 3-week disappearance intervals.',
        },
        {
          id: 'npc-alan-mercer',
          name: 'Dr. Alan Mercer (Medical Examiner)',
          description:
            'Pressured county pathologist who signed the "undetermined drowning" certificate despite knowing the lungs contained no water.',
          secret:
            'Kept a vial of the crystalline spinal fluid hidden in his private laboratory freezer.',
        },
        {
          id: 'npc-tyler-vance',
          name: 'Tyler Vance (Orchard Witness)',
          description:
            'Local youth who attended the June 11 bonfire and heard the strange metallic hum from the field after midnight.',
          secret:
            'Found Todd’s baseball cap beside the sunken limestone grate two days after the party but was too afraid to tell police.',
        },
        {
          id: 'npc-cole-holloway',
          name: 'Cole Holloway (Watershed Hydrologist)',
          description:
            'Soft-spoken county technician with a pinprick scar at the base of his neck, serving the entity beneath Ovidhall Lake.',
          secret:
            'Uses the Smiley Face symbol to mark intake culverts where the stasis-held victims are released back into surface ponds.',
        },
        {
          id: 'npc-glaaki-brood',
          name: 'The Spined Dweller of Ovidhall (Brood of Gla’aki)',
          description:
            'An ancient, iridescent oval mass bristling with flexible metallic spines, resting in the glacial aquifer beneath the kettle lake.',
          secret:
            'Vulnerable to fire, high-voltage electrical discharge, and the collapse of the limestone cavern roof.',
        },
      ],
      locations: [
        {
          id: 'loc-ovidhall-lake-shore',
          name: 'Ovidhall Lake (Casnovia, Michigan)',
          description:
            'Boggy, reed-ringed kettle pond where the victim’s body was found floating vertically on July 2, 2005.',
          atmosphere:
            'Stagnant summer heat, dragonflies, and an unnatural cold spot at the pond’s center.',
        },
        {
          id: 'loc-muskegon-morgue',
          name: 'Muskegon County Medical Examiner’s Office',
          description: 'Modern forensic pathology and toxicology laboratory.',
          atmosphere: 'Sterile steel, chromatography monitors, and forensic dread.',
        },
        {
          id: 'loc-casnovia-orchard',
          name: 'Casnovia Apple Orchard & Bonfire Field',
          description:
            'Rural Michigan orchard where the June 11 party took place and the 12:51 AM calls originated.',
          atmosphere: 'Twisted apple boughs, tall marsh grass, and a hidden karst sinkhole.',
        },
        {
          id: 'loc-half-moon-bar',
          name: 'Half Moon Bar & Grille (Ravenna)',
          description:
            'Small-town Michigan bar and adjacent county watershed station.',
          atmosphere: 'Neon signs, gravel parking lot, and old hydrological charts.',
        },
        {
          id: 'loc-subterranean-cenote',
          name: 'Subterranean Glacial Cenote',
          description:
            'Flooded limestone cavern connecting the orchard sinkhole to the bottom of Ovidhall Lake.',
          atmosphere: 'Green bioluminescence, black water, and metallic spines.',
        },
      ],
    },
    externalLinks: [
      {
        label: 'Wikipedia (Smiley Face Murder Theory)',
        url: 'https://en.wikipedia.org/wiki/Smiley_face_murder_theory',
      },
      {
        label: 'Uncovered Cold Case File (Todd Geib - 2005)',
        url: 'https://uncovered.com/cases/todd-geib',
      },
    ],
    handouts: [
      {
        slug: 'autopsy-toxicology-muskegon',
        title: 'Muskegon Forensic Autopsy & Toxicology Report (#05-712)',
        image: '/handouts/ovidhall-lake-anomaly-2005/autopsy-toxicology-muskegon.webp',
        handoutType: 'report',
        nodeId: 'node-muskegon-morgue',
        textContent:
          'MUSKEGON COUNTY MEDICAL EXAMINER - CASE #2005-0712 (GEIB, TODD). Recovery: Floating vertically (head/shoulders above surface) in Ovidhall Lake after 21 days. Lungs: 0 mL pond water, negative for diatoms. Tissue state: Consistent with 24-48h post-mortem, NOT 21 days. Blood: Unidentified tricyclic organometallic compound.',
      },
      {
        slug: 'photo-ovidhall-smiley-graffiti',
        title: 'Evidence Photo: Ovidhall Lake Weir & UV Smiley Glyph',
        image: '/handouts/ovidhall-lake-anomaly-2005/photo-ovidhall-smiley-graffiti.webp',
        handoutType: 'newspaper',
        nodeId: 'node-ovidhall-lake-shore',
        textContent:
          'EVIDENCE PHOTO #14 (July 2, 2005 - Ovidhall Lake, Casnovia MI): Concrete outflow weir 30 yards from vertical body recovery site. Yellow luminescent "Smiley Face" symbol painted with crushed freshwater nacre, oriented toward the orchard karst line.',
      },
      {
        slug: 'gsm-tower-triangulation-log',
        title: 'Cingular Wireless GSM Triangulation Log (June 12, 2005)',
        image: '/handouts/ovidhall-lake-anomaly-2005/gsm-tower-triangulation-log.webp',
        handoutType: 'report',
        nodeId: 'node-casnovia-orchard',
        textContent:
          'CELLULAR SUBPOENA LOG - JUNE 12, 2005: 00:47 AM (Outgoing - 22 sec, Sector B Orchard); 00:49 AM (Outgoing - 14 sec); 00:51 AM (Outgoing - "I’m in a field" - Signal attenuation indicates transmitter depth -12.4m BELOW surface terrain in limestone karst cavity).',
      },
      {
        slug: 'audio-voicemail-in-a-field',
        title: 'Voicemail Audio Extraction: June 12, 2005 (00:51 AM)',
        image: '/handouts/ovidhall-lake-anomaly-2005/gsm-tower-triangulation-log.webp',
        audioUrl: '/audio/handouts/ovidhall-lake-anomaly-2005/voicemail-in-a-field-2005.mp3',
        handoutType: 'report',
        nodeId: 'node-casnovia-orchard',
        textContent:
          'Extracted cellular voicemail from 12:51 AM, June 12, 2005: heavy breathing, complete absence of crickets, a confused whisper ("I’m in a field... the water is above me..."), and a deep, resonant metallic chime before static cuts the line.',
      },
    ],
  },
];
