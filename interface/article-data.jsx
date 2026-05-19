/* Article content data — encyclopedia entry about Paris with 7 embedded fakes */
/* eslint-disable no-unused-vars */

// Each segment is either a string (plain text) or a token object.
// Tokens have { id, text, fake?: { id, truth, hint } }
// Wiki-style links: { link: true, text }

const ARTICLE = /*EDITMODE-BEGIN*/{
  "title": "Paris",
  "subtitle": "Capital city of France"
}/*EDITMODE-END*/;

// Helper to build paragraphs concisely
const t = (id, text, fake) => ({ kind: "token", id, text, fake });
const L = (text) => ({ kind: "link", text });

const ARTICLE_BODY = [
  {
    kind: "lead",
    paragraphs: [
      [
        t("p1_a", "Paris"),
        " is the ",
        t("p1_b", "capital"),
        " and most populous ",
        t("p1_c", "city"),
        " of ",
        L("France"),
        ". Situated on the river ",
        L("Seine"),
        ", in the northern part of the country, it occupies a central position in the ",
        t("p1_d", "Île-de-France"),
        " region. The city proper has an estimated population of ",
        t("p1_e", "2.1 million"),
        " residents, while its metropolitan area exceeds ",
        t("p1_f", "12 million"),
        " inhabitants — one of the largest urban agglomerations in Europe."
      ],
      [
        "The site was originally settled by the ",
        L("Parisii"),
        ", a ",
        t("p2_a", "Celtic tribe", null),
        ", around the middle of the ",
        t("p2_b", "3rd century BC", null),
        ". It later became a Roman town known as ",
        t("p2_c", "Lutetia"),
        ", and the modern city was ",
        t("p2_d", "founded in 987 AD", {
          id: "F1",
          truth: "Paris is far older — it grew from a Celtic settlement of the Parisii (c. 3rd century BC) and the Roman town of Lutetia. 987 AD is the date Hugh Capet was crowned, marking it as the royal seat, not the city's founding.",
          hint: "The Parisii were already there long before."
        }),
        " on the île de la Cité. According to one tradition, the name itself derives from the ",
        t("p2_e", "Greek goddess Athena", {
          id: "F2",
          truth: "The name derives from the Parisii, a Gallic Celtic people. No serious tradition links it to Athena.",
          hint: "The tribe gave the city its name."
        }),
        ", though most modern scholars dispute this account."
      ]
    ]
  },
  {
    kind: "section",
    heading: "Geography",
    paragraphs: [
      [
        "Paris occupies a basin in the ",
        t("geo_a", "Île-de-France"),
        " region drained by the river Seine, which crosses the city from ",
        t("geo_b", "southeast to southwest"),
        ". The Seine then flows ",
        t("geo_c", "north toward Belgium", {
          id: "F3",
          truth: "The Seine flows roughly northwest from Paris and empties into the English Channel at Le Havre — not toward Belgium.",
          hint: "Check the direction the river actually empties."
        }),
        " before reaching the sea. The terrain is gently undulating, with ",
        t("geo_d", "Montmartre"),
        " at ",
        t("geo_e", "130 metres"),
        " forming its highest natural point."
      ],
      [
        "The city is roughly ",
        t("geo_f", "oval-shaped"),
        " and divided into ",
        t("geo_g", "twenty arrondissements"),
        " arranged in a clockwise spiral. Each arrondissement maintains its own ",
        L("mairie"),
        " and local administration, though municipal authority is centralised in the ",
        t("geo_h", "Hôtel de Ville"),
        "."
      ]
    ]
  },
  {
    kind: "section",
    heading: "History",
    paragraphs: [
      [
        "By the early Middle Ages, Paris had grown into a major centre of trade, learning and royal authority. The ",
        L("University of Paris"),
        " was established around ",
        t("hist_a", "1150"),
        " and quickly became one of the most prestigious institutions in Christendom. The construction of ",
        t("hist_b", "Notre-Dame Cathedral"),
        " began in 1163 and the building was substantially completed in ",
        t("hist_c", "1789", {
          id: "F4",
          truth: "Notre-Dame's main structure was completed around 1345. 1789 is the start of the French Revolution — during which the cathedral was actually desecrated.",
          hint: "1789 is famous for an event other than cathedral-building."
        }),
        "."
      ],
      [
        "Following centuries of expansion under the ",
        t("hist_d", "Capetian"),
        " and ",
        t("hist_e", "Bourbon"),
        " dynasties, Paris was extensively replanned in the ",
        t("hist_f", "1850s and 1860s"),
        " under the prefect ",
        t("hist_g", "Baron Haussmann"),
        ", whose programme of wide boulevards, uniform façades and public parks produced much of the cityscape recognised today."
      ]
    ]
  },
  {
    kind: "section",
    heading: "Demographics",
    paragraphs: [
      [
        "French is the sole official language of Paris and of the French Republic. The city's administrative bodies, however, formally recognise ",
        t("dem_a", "twelve official languages", {
          id: "F5",
          truth: "French is the only official language. France famously has no official status for regional languages at the national level.",
          hint: "Look up France's official-language policy."
        }),
        " for the purpose of inclusive public services."
      ],
      [
        "The metropolitan area is among the most ethnically diverse in continental Europe. Significant communities trace their roots to ",
        t("dem_b", "North Africa"),
        ", ",
        t("dem_c", "Sub-Saharan Africa"),
        ", ",
        t("dem_d", "Southeast Asia"),
        " and the ",
        t("dem_e", "Caribbean"),
        ", reflecting the country's colonial and post-colonial history."
      ]
    ]
  },
  {
    kind: "section",
    heading: "Culture and Landmarks",
    paragraphs: [
      [
        "The ",
        t("cul_a", "Eiffel Tower"),
        ", a wrought-iron lattice tower designed by ",
        L("Gustave Eiffel"),
        ", was constructed as the centrepiece of the ",
        t("cul_b", "1923 World's Fair", {
          id: "F6",
          truth: "The Eiffel Tower was completed in 1889 for the Exposition Universelle marking the centenary of the French Revolution. No 1923 World's Fair took place in Paris.",
          hint: "Check the centenary the Tower was built to commemorate."
        }),
        " and has since become the iconic symbol of the city. At ",
        t("cul_c", "330 metres"),
        " it briefly held the title of the world's tallest structure."
      ],
      [
        "Other notable institutions include the ",
        L("Louvre"),
        ", the largest art museum in the world by floor area; the ",
        t("cul_d", "Musée d'Orsay"),
        ", housed in a converted ",
        t("cul_e", "Beaux-Arts railway station"),
        "; and the ",
        t("cul_f", "Centre Pompidou"),
        ", a major venue for modern art."
      ],
      [
        "The Paris ",
        t("cul_g", "Métro"),
        " is a rapid transit system serving the city and inner suburbs. It is among the densest networks in the world and originally ",
        t("cul_h", "opened in 1965", {
          id: "F7",
          truth: "The Paris Métro opened on 19 July 1900 for the Universal Exposition — making it one of the oldest underground rail networks in the world, not a 1960s system.",
          hint: "It was built in time for an Exposition Universelle."
        }),
        ", initially operating a single line between ",
        t("cul_i", "Porte Maillot"),
        " and ",
        t("cul_j", "Porte de Vincennes"),
        "."
      ]
    ]
  }
];

const INFOBOX_FACTS = [
  { label: "DESIGNATION", value: "Paris" },
  { label: "COUNTRY",     value: "France" },
  { label: "REGION",      value: "Île-de-France" },
  { label: "AREA",        value: "105.4 km²" },
  { label: "ELEVATION",   value: "28–130 m" },
  { label: "POPULATION",  value: "2.10M" },
  { label: "METRO",       value: "12.4M" },
  { label: "DEMONYM",     value: "Parisien" },
  { label: "STATUS",      value: "LIVE", live: true },
];

window.WIKIFAKE_ARTICLE = ARTICLE;
window.WIKIFAKE_BODY = ARTICLE_BODY;
window.WIKIFAKE_INFOBOX = INFOBOX_FACTS;

// Collect fake IDs in order for HUD targets list
window.WIKIFAKE_FAKES = (() => {
  const out = [];
  for (const block of ARTICLE_BODY) {
    for (const para of block.paragraphs) {
      for (const seg of para) {
        if (typeof seg === "object" && seg.kind === "token" && seg.fake) {
          out.push({ ...seg.fake, tokenId: seg.id, text: seg.text });
        }
      }
    }
  }
  return out;
})();
