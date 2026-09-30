/** Casa Ribeira content. Owner-written except reviews (third-party). */
const img = (id: string, w = 1600) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=75&auto=format&fit=crop`;

export const PHOTOS = [
  {
    src: img("1513735492246-483525079686"),
    alt: "Sunset over the Douro river and the Dom Luís I bridge",
    title: "Wake up on the Douro",
    text: "A 19th-century merchant house on the Ribeira waterfront",
  },
  {
    src: img("1445019980597-93fa8acb246c"),
    alt: "Loungers on a sunny rooftop terrace",
    title: "The rooftop",
    text: "Port wine at sunset, every evening from 18:00",
  },
  {
    src: img("1590490360182-c33d57733427"),
    alt: "Hotel room with a tufted sofa and red cushions",
    title: "Twelve rooms, no two alike",
    text: "Azulejo tiles, oak floors, river light",
  },
  {
    src: img("1533777857889-4be7c70b33f7"),
    alt: "A guest enjoying breakfast",
    title: "Breakfast until 10:30",
    text: "Pastéis de nata from the bakery next door",
  },
];

export const ROOMS = [
  {
    name: "Classic Double",
    desc: "Quiet courtyard side, 18 m²",
    price: "from €145",
    img: img("1631049307264-da0ec9d70304", 900),
    alt: "Bright classic double room",
    tags: ["courtyard"],
  },
  {
    name: "Deluxe River",
    desc: "Morning sun over the Douro, 24 m²",
    price: "from €195",
    img: img("1582719478250-c89cae4dc85b", 900),
    alt: "Deluxe room with sunlight through tall windows",
    tags: ["river view"],
    badge: "Most booked",
  },
  {
    name: "Superior Salon",
    desc: "Velvet sofa and reading corner, 28 m²",
    price: "from €225",
    img: img("1590490360182-c33d57733427", 900),
    alt: "Superior room with a tufted sofa",
    tags: ["river view", "sofa"],
  },
  {
    name: "Ribeira Suite",
    desc: "Glass bathroom, terrace, 42 m²",
    price: "from €340",
    img: img("1578683010236-d716f9a3f461", 900),
    alt: "Suite with a glass-walled bathroom",
    tags: ["terrace", "bathtub"],
  },
];

export const ARRIVAL_STEPS = [
  {
    title: "Drop your bags any time from 09:00",
    when: "Before check-in",
    detail: "Free luggage room at reception; explore light",
  },
  {
    title: "Check-in opens at 15:00",
    when: "15:00",
    detail: "Early rooms go to arriving guests first",
  },
  {
    title: "Welcome port on the rooftop",
    when: "18:00",
    detail: "A glass of tawny for every new guest",
  },
];

export const BREAKFAST = [
  { name: "Pastel de nata", desc: "Warm, from Padaria Ribeira next door", tags: ["vegetarian"] },
  { name: "Francesinha toast", desc: "Our breakfast take on the Porto classic", tags: [] },
  {
    name: "Seasonal fruit & yoghurt",
    desc: "Douro valley figs and grapes",
    tags: ["vegetarian", "gluten-free"],
  },
  { name: "Eggs any style", desc: "With broa corn bread", tags: ["vegetarian"] },
];

export const EVENTS = [
  {
    title: "Fado in the cellar",
    when: "Tonight · 21:30",
    detail: "Two guitars and a voice, 40 seats; ask reception",
    indoor: true,
  },
  {
    title: "Port tasting across the river",
    when: "Daily · 16:00",
    detail: "Guided cellar visit in Vila Nova de Gaia, 10 min walk",
    indoor: true,
  },
  {
    title: "Sunset on the rooftop",
    when: "Daily · 19:30",
    detail: "Weather permitting",
    indoor: false,
  },
  {
    title: "Market morning at Bolhão",
    when: "Sat · 09:00",
    detail: "Walk with our chef, back for breakfast",
    indoor: false,
  },
];

export const OFFER = {
  title: "Stay three nights, the third is on us",
  body: "Book directly for three nights or more and we cover the third, plus breakfast and the welcome port.",
  img: img("1445019980597-93fa8acb246c", 900),
  alt: "Rooftop terrace in the sun",
  badge: "Direct booking",
};

/** Third-party reviews: rendered, never sent to a decider. */
export const REVIEWS = [
  {
    text: "The river view from the Deluxe room made the whole trip. Staff remembered our names by day two.",
    stars: 5,
    author: "Hannah, Leeds",
    date: "Sep 2026",
  },
  {
    text: "Perfect location for walking everywhere. Breakfast pastéis were dangerously good.",
    stars: 5,
    author: "Marco, Bologna",
    date: "Aug 2026",
  },
  {
    text: "Rooms on the river side can hear the evening music; ask for courtyard if you sleep early.",
    stars: 4,
    author: "Aiko, Osaka",
    date: "Aug 2026",
  },
];
