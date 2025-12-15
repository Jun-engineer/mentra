export type TemplateSeedItem = {
  id: string;
  title: string;
  description: string;
  videoUrl?: string;
  steps: string[];
};

export type TemplateSubcategoryDefinition = {
  id: string;
  label: string;
  items: TemplateSeedItem[];
};

export type TemplateCategoryDefinition = {
  id: string;
  label: string;
  subcategories: TemplateSubcategoryDefinition[];
};

export const TEMPLATE_MENU: TemplateCategoryDefinition[] = [
  {
    id: "food",
    label: "Food",
    subcategories: [
      {
        id: "snacks",
        label: "Snacks",
        items: [
          {
            id: "template-food-snacks-chips",
            title: "House Chips & Salsa",
            description:
              "Crisp kettle chips tossed in seasoning salt with a bright salsa roja. Prep in under 5 minutes during the mid-shift reset.",
            steps: [
              "Heat chips in the oven for 45 seconds to refresh crunch.",
              "Toss in finishing salt and plate in the shallow bowl.",
              "Ladle 3 oz salsa roja into ramekin; garnish with chopped cilantro.",
              "Serve with shareable napkins and remind guests of spice level."
            ]
          }
        ]
      },
      {
        id: "sides",
        label: "Sides",
        items: [
          {
            id: "template-food-sides-broccolini",
            title: "Roasted Garlic Broccolini",
            description:
              "Quick-fire broccolini tossed with confit garlic oil and lemon zest. Ideal for pairing with mains on busy nights.",
            steps: [
              "Blanch broccolini for 60 seconds and shock in ice water.",
              "In sauté pan, sear with garlic oil until lightly charred.",
              "Finish with lemon zest, chili flakes, and Maldon salt.",
              "Plate in share bowl and drizzle remaining oil over top."
            ]
          }
        ]
      },
      {
        id: "mains",
        label: "Mains",
        items: [
          {
            id: "template-food-mains-burger",
            title: "Mentra Smash Burger",
            description:
              "Double smashed beef patties with caramelized onions, cheddar, and house sauce. Ideal for service training reps.",
            steps: [
              "Press two 3 oz patties on the flat top and season immediately.",
              "Flip after 60 seconds, top with cheddar, and steam to melt.",
              "Toast brioche bun, spread house sauce on both sides.",
              "Stack patties, add caramelized onions and butter lettuce, then spike."
            ]
          }
        ]
      },
      {
        id: "desserts",
        label: "Desserts",
        items: [
          {
            id: "template-food-desserts-pudding",
            title: "Salted Caramel Pudding",
            description:
              "Creamy butterscotch pudding portioned for service line with a quick brûléed sugar cap.",
            steps: [
              "Portion 5 oz of chilled pudding into coupe glass.",
              "Top with whipped cream rosette and drizzle caramel.",
              "Torch turbinado sugar until amber and let set.",
              "Finish with flaky sea salt and serve with dessert spoon."
            ]
          }
        ]
      }
    ]
  },
  {
    id: "drink",
    label: "Drink",
    subcategories: [
      {
        id: "soft-drinks",
        label: "Soft Drinks",
        items: [
          {
            id: "template-drink-soft-ginger",
            title: "Ginger Citrus Fizz",
            description:
              "House-made ginger syrup topped with yuzu soda and candied ginger garnish. Great for zero-proof pairing.",
            steps: [
              "Fill Collins glass with pebble ice.",
              "Add 1.5 oz ginger syrup and 0.5 oz lime juice.",
              "Top with yuzu soda, stir gently, and garnish with candied ginger skewer."
            ]
          }
        ]
      },
      {
        id: "beer",
        label: "Beer",
        items: [
          {
            id: "template-drink-beer-pale",
            title: "Mentra Pale Ale",
            description:
              "Citrus-forward pale ale from our local partner brewery. Emphasize cold glassware and head retention.",
            steps: [
              "Rinse 16 oz glass with cold water and hold at 45° under tap.",
              "Pour steadily, straightening glass at halfway point.",
              "Cap pour with 1 inch foam head, wipe glass, and serve on coaster."
            ]
          }
        ]
      },
      {
        id: "whiskey",
        label: "Whiskey",
        items: [
          {
            id: "template-drink-whiskey-oldfashioned",
            title: "Smoked Old Fashioned",
            description:
              "Classic build finished with maple smoke. Perfect for showcasing bar flair in training videos.",
            steps: [
              "Stir 2 oz rye, 0.25 oz demerara, and 2 dashes bitters over ice.",
              "Strain over large cube in rocks glass.",
              "Torch charred maple plank and capture smoke beneath cloche.",
              "Express orange peel, rim glass, and present with cloche reveal."
            ]
          }
        ]
      },
      {
        id: "red-wine",
        label: "Red Wine",
        items: [
          {
            id: "template-drink-red-pinot",
            title: "Pinot Noir Service",
            description:
              "Bottle service guide for the house pinot noir including temperature, glassware, and talking points.",
            steps: [
              "Confirm bottle vintage and guest preference for tasting.",
              "Present label to guest, open with waiter’s friend, and offer cork.",
              "Pour 2 oz taste, receive approval, then serve clockwise with 5 oz pours.",
              "Rest bottle on coaster with label facing guests."
            ]
          }
        ]
      },
      {
        id: "white-wine",
        label: "White Wine",
        items: [
          {
            id: "template-drink-white-sauvignon",
            title: "Sauvignon Blanc Service",
            description:
              "Highlight the bright, herbal notes of our sauvignon blanc while reinforcing chill-hold procedures.",
            steps: [
              "Retrieve bottle from cold well and towel dry.",
              "Present, uncork, and offer sample to host.",
              "Serve 5 oz pours into chilled stems, finishing any remaining wine evenly.",
              "Store bottle in silver chiller with fresh ice if not finished."
            ]
          }
        ]
      },
      {
        id: "sake",
        label: "Sake",
        items: [
          {
            id: "template-drink-sake-junmai",
            title: "Junmai Ginjo Pour",
            description:
              "Step-by-step for presenting our feature sake flight, including pronunciation cues for staff training.",
            steps: [
              "Warm carafe in 120°F water bath for 60 seconds.",
              "Announce brewery story and tasting notes before pouring.",
              "Pour 2 oz into ochoko for each guest, rotating clockwise.",
              "Offer chilled water palate cleanser and thank guests."
            ]
          }
        ]
      }
    ]
  }
];
