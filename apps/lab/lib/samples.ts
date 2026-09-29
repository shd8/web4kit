/** Sample data per shape, bound through canonical roles. */
export const SAMPLE: Record<string, { data: unknown; binding: Record<string, string> }> = {
  "media-list": {
    data: Array.from({ length: 6 }, (_, i) => ({
      src: `https://images.unsplash.com/photo-1558030006-450675393462?w=600&q=60&auto=format&fit=crop`,
      alt: `Dish ${i}`,
      name: `Dish ${i}`,
      text: `Caption ${i} with a few words`,
    })),
    binding: { image: "src", imageAlt: "alt", title: "name", caption: "text" },
  },
  list: {
    data: [
      {
        name: "Grilled octopus",
        desc: "Smoked paprika, potato",
        price: "€24",
        tags: ["gluten-free"],
        when: "Fri 3 Oct",
        rating: 5,
        who: "Ana",
        status: "On time",
        img: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=600&q=60&auto=format&fit=crop",
      },
      {
        name: "Iberian pork",
        desc: "Charred leeks",
        price: "€28",
        tags: [],
        when: "Sat 4 Oct",
        rating: 4,
        who: "Tom",
        status: "Late",
        img: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600&q=60&auto=format&fit=crop",
      },
    ],
    binding: {
      title: "name",
      subtitle: "desc",
      value: "price",
      tags: "tags",
      date: "when",
      body: "desc",
      rating: "rating",
      author: "who",
      badge: "status",
      image: "img",
    },
  },
  record: {
    data: {
      t: "New: Sunday brunch",
      b: "From 11:00 with live jazz.",
      img: "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=600&q=60&auto=format&fit=crop",
    },
    binding: { title: "t", body: "b", image: "img" },
  },
  schedule: {
    data: {
      status: "closed",
      statusText: "Closed · opens tomorrow at 13:00",
      days: [{ label: "Mon", hours: "13:00–16:00 · 20:00–23:00", today: true }],
    },
    binding: {},
  },
  geo: {
    data: {
      name: "Casa Lumbre",
      address: "Calle de Lavapiés 12, Madrid",
      lat: 40.41,
      lng: -3.7,
      directionsUrl: "https://maps.example/?q=x",
      phone: "+34 910 000 000",
      distanceText: "12 min walk",
    },
    binding: {},
  },
  timeseries: {
    data: {
      unit: "orders",
      series: [
        {
          label: "On time",
          points: [
            { t: "W1", v: 10 },
            { t: "W2", v: 14 },
            { t: "W3", v: 12 },
          ],
        },
      ],
    },
    binding: {},
  },
  graph: {
    data: {
      nodes: [
        { id: "a", label: "Acme", status: "ok" },
        { id: "b", label: "Beta", status: "bad" },
      ],
      edges: [{ source: "a", target: "b" }],
    },
    binding: {},
  },
};
