# Recipe data

Exported from the old meal planner. `recipes.json` holds 20,289 recipes (about 19 MB), `ingredients.json` the 136 ingredients they use. Recipe text is in English only.

## recipes.json

| Field | |
| --- | --- |
| `id` | Number. The old site's links use it (`/#/recipe/123`). Some ids were deleted, so there are gaps. |
| `title`, `description` | Text. |
| `cuisine` | `Italian`, `Thai`, ... |
| `course` | `breakfast`, `main`, `side`, `soup`, `salad`, `snack` or `dessert`. |
| `diets` | Any of `vegetarian`, `vegan`, `gluten-free`, `dairy-free`. |
| `minutes` | Total time. |
| `servings` | How many people the amounts are for. |
| `caloriesPerServing` | kcal. |
| `rating`, `ratingCount` | Average rating out of 5, and how many ratings. |
| `createdAt` | `YYYY-MM-DD`. |
| `ingredients` | `{ ingredient, quantity, unit, note? }`. `ingredient` is an id in `ingredients.json`. `quantity` and `unit` are both `null` for "to taste". |
| `steps` | Text, in order. |

Units: `g`, `kg`, `lb` (mass); `ml`, `l`, `tsp`, `tbsp`, `cup` (volume); `piece`, `clove`, `can`, `pinch` (counts).
US measures: 1 cup = 236.59 ml, 1 tbsp = 14.79 ml, 1 tsp = 4.93 ml, 1 fl oz = 29.57 ml, 1 lb = 453.59 g, 1 oz = 28.35 g.

## ingredients.json

`{ id, name, names: { es }, aisle, animal?, gluten?, allergens?, gramsPerCup?, gramsPerPiece? }`.

- `name` is English, `names.es` Spanish.
- `aisle` is where it is in a shop (English).
- `animal` is `meat`, `fish`, `dairy`, `egg` or `honey`; `gluten` is `true` when it contains gluten.
- `allergens`: any of `gluten`, `dairy`, `egg`, `fish`, `shellfish`, `nuts`, `peanuts`, `soy`, `sesame`, `mustard`.
- `gramsPerCup`: the density, for turning volumes into grams and back. Missing when it isn't known.
- `gramsPerPiece`: what one `piece`, `clove` or `can` of it weighs. Missing when it isn't known.
