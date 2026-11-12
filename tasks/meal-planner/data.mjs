// Writes the Meal planner fixture: fixture/data/ingredients.json and fixture/data/recipes.json. Deterministic (seeded),
// so the reference app, the rubric's examples and every run see the same recipes. Run with `node tasks/meal-planner/data.mjs`.
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

let seed = 20261112
function random() {
  seed |= 0
  seed = (seed + 0x6D2B79F5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const pick = list => list[Math.floor(random() * list.length)]
const between = (min, max) => min + Math.floor(random() * (max - min + 1))
const sample = (list, count) => [...list].sort(() => random() - 0.5).slice(0, count)

// id, name, aisle, what it is for diets, and the amounts recipes use: [unit, min, max, step].
// `animal`: meat, fish, dairy, egg or honey. `gluten`: contains gluten.
const catalog = [
  ["onion", "Onion", "Produce", {}, [["piece", 1, 2, 0.5], ["g", 100, 300, 50]]],
  ["red-onion", "Red onion", "Produce", {}, [["piece", 1, 2, 0.5]]],
  ["garlic", "Garlic", "Produce", {}, [["clove", 1, 4, 1]]],
  ["tomato", "Tomato", "Produce", {}, [["piece", 1, 4, 1], ["g", 200, 500, 50]]],
  ["cherry-tomatoes", "Cherry tomatoes", "Produce", {}, [["g", 150, 400, 50]]],
  ["potato", "Potato", "Produce", {}, [["g", 300, 1000, 100], ["kg", 0.5, 1, 0.25]]],
  ["sweet-potato", "Sweet potato", "Produce", {}, [["g", 300, 800, 100]]],
  ["carrot", "Carrot", "Produce", {}, [["piece", 1, 3, 1], ["g", 100, 300, 50]]],
  ["bell-pepper", "Bell pepper", "Produce", {}, [["piece", 1, 2, 1]]],
  ["spinach", "Spinach", "Produce", {}, [["g", 100, 300, 50], ["cup", 1, 3, 1]]],
  ["kale", "Kale", "Produce", {}, [["g", 100, 250, 50]]],
  ["lemon", "Lemon", "Produce", {}, [["piece", 0.5, 2, 0.5]]],
  ["lime", "Lime", "Produce", {}, [["piece", 1, 2, 1]]],
  ["ginger", "Ginger", "Produce", {}, [["g", 10, 30, 5], ["tbsp", 1, 2, 1]]],
  ["cilantro", "Cilantro", "Produce", {}, [["g", 10, 30, 5], ["tbsp", 2, 4, 1]]],
  ["parsley", "Parsley", "Produce", {}, [["g", 10, 30, 5], ["tbsp", 2, 4, 1]]],
  ["basil", "Basil", "Produce", {}, [["g", 10, 30, 5]]],
  ["mint", "Mint", "Produce", {}, [["g", 5, 20, 5]]],
  ["mushrooms", "Mushrooms", "Produce", {}, [["g", 150, 400, 50]]],
  ["zucchini", "Zucchini", "Produce", {}, [["piece", 1, 2, 1]]],
  ["eggplant", "Eggplant", "Produce", {}, [["piece", 1, 2, 1]]],
  ["avocado", "Avocado", "Produce", {}, [["piece", 1, 2, 1]]],
  ["cucumber", "Cucumber", "Produce", {}, [["piece", 0.5, 1, 0.5]]],
  ["celery", "Celery", "Produce", {}, [["piece", 1, 3, 1]]],
  ["broccoli", "Broccoli", "Produce", {}, [["g", 200, 500, 50]]],
  ["cauliflower", "Cauliflower", "Produce", {}, [["g", 300, 800, 100]]],
  ["cabbage", "Cabbage", "Produce", {}, [["g", 200, 500, 50]]],
  ["leek", "Leek", "Produce", {}, [["piece", 1, 2, 1]]],
  ["chili", "Red chili", "Produce", {}, [["piece", 1, 2, 1]]],
  ["jalapeno", "Jalapeño", "Produce", {}, [["piece", 1, 3, 1]]],
  ["scallion", "Scallions", "Produce", {}, [["piece", 2, 4, 1]]],
  ["apple", "Apple", "Produce", {}, [["piece", 1, 3, 1]]],
  ["banana", "Banana", "Produce", {}, [["piece", 1, 3, 1]]],
  ["berries", "Mixed berries", "Produce", {}, [["g", 100, 300, 50], ["cup", 0.5, 1.5, 0.5]]],
  ["mango", "Mango", "Produce", {}, [["piece", 1, 2, 1]]],
  ["lettuce", "Lettuce", "Produce", {}, [["piece", 1, 1, 1]]],
  ["corn", "Sweet corn", "Produce", {}, [["g", 150, 300, 50]]],
  ["butternut", "Butternut squash", "Produce", {}, [["g", 400, 900, 100]]],
  ["chicken-breast", "Chicken breast", "Meat & fish", { animal: "meat" }, [["g", 300, 700, 50], ["lb", 0.5, 1.5, 0.5]]],
  ["chicken-thigh", "Chicken thighs", "Meat & fish", { animal: "meat" }, [["g", 400, 800, 100]]],
  ["ground-beef", "Ground beef", "Meat & fish", { animal: "meat" }, [["g", 300, 600, 50], ["lb", 1, 1, 1]]],
  ["beef-steak", "Beef steak", "Meat & fish", { animal: "meat" }, [["g", 300, 600, 50]]],
  ["pork-shoulder", "Pork shoulder", "Meat & fish", { animal: "meat" }, [["g", 500, 1000, 100], ["kg", 1, 1.5, 0.5]]],
  ["bacon", "Bacon", "Meat & fish", { animal: "meat" }, [["g", 100, 250, 50], ["piece", 2, 6, 1]]],
  ["chorizo", "Chorizo", "Meat & fish", { animal: "meat" }, [["g", 100, 200, 50]]],
  ["lamb", "Lamb", "Meat & fish", { animal: "meat" }, [["g", 400, 800, 100]]],
  ["salmon", "Salmon fillet", "Meat & fish", { animal: "fish" }, [["g", 300, 600, 50]]],
  ["cod", "Cod fillet", "Meat & fish", { animal: "fish" }, [["g", 300, 600, 50]]],
  ["shrimp", "Shrimp", "Meat & fish", { animal: "fish" }, [["g", 200, 500, 50]]],
  ["egg", "Eggs", "Dairy & eggs", { animal: "egg" }, [["piece", 1, 4, 1]]],
  ["butter", "Butter", "Dairy & eggs", { animal: "dairy" }, [["g", 20, 120, 10], ["tbsp", 1, 4, 1]]],
  ["milk", "Milk", "Dairy & eggs", { animal: "dairy" }, [["ml", 100, 500, 50], ["cup", 0.5, 2, 0.25]]],
  ["cream", "Heavy cream", "Dairy & eggs", { animal: "dairy" }, [["ml", 100, 300, 50], ["cup", 0.25, 1, 0.25]]],
  ["yogurt", "Greek yogurt", "Dairy & eggs", { animal: "dairy" }, [["g", 100, 300, 50], ["cup", 0.5, 1, 0.25]]],
  ["parmesan", "Parmesan", "Dairy & eggs", { animal: "dairy" }, [["g", 20, 80, 10], ["tbsp", 2, 4, 1]]],
  ["mozzarella", "Mozzarella", "Dairy & eggs", { animal: "dairy" }, [["g", 125, 250, 125]]],
  ["feta", "Feta", "Dairy & eggs", { animal: "dairy" }, [["g", 50, 200, 50]]],
  ["cheddar", "Cheddar", "Dairy & eggs", { animal: "dairy" }, [["g", 50, 200, 50], ["cup", 0.5, 1, 0.5]]],
  ["ricotta", "Ricotta", "Dairy & eggs", { animal: "dairy" }, [["g", 100, 250, 50]]],
  ["gruyere", "Gruyère", "Dairy & eggs", { animal: "dairy" }, [["g", 50, 150, 25]]],
  ["bread", "Bread", "Bakery", { gluten: true }, [["piece", 2, 4, 1]]],
  ["tortilla", "Tortillas", "Bakery", { gluten: true }, [["piece", 4, 8, 2]]],
  ["pita", "Pita bread", "Bakery", { gluten: true }, [["piece", 2, 4, 1]]],
  ["baguette", "Baguette", "Bakery", { gluten: true }, [["piece", 0.5, 1, 0.5]]],
  ["bun", "Burger buns", "Bakery", { gluten: true }, [["piece", 2, 4, 1]]],
  ["corn-tortilla", "Corn tortillas", "Bakery", {}, [["piece", 6, 10, 2]]],
  ["flour", "All-purpose flour", "Baking", { gluten: true }, [["g", 100, 400, 25], ["cup", 0.5, 2, 0.25], ["tbsp", 1, 3, 1]]],
  ["sugar", "Sugar", "Baking", {}, [["g", 50, 200, 25], ["cup", 0.25, 1, 0.25], ["tsp", 1, 2, 1]]],
  ["brown-sugar", "Brown sugar", "Baking", {}, [["g", 50, 150, 25], ["tbsp", 1, 3, 1]]],
  ["baking-powder", "Baking powder", "Baking", {}, [["tsp", 1, 2, 0.5]]],
  ["baking-soda", "Baking soda", "Baking", {}, [["tsp", 0.5, 1, 0.5]]],
  ["vanilla", "Vanilla extract", "Baking", {}, [["tsp", 1, 2, 0.5]]],
  ["cocoa", "Cocoa powder", "Baking", {}, [["g", 20, 60, 10], ["tbsp", 2, 4, 1]]],
  ["chocolate", "Dark chocolate", "Baking", { animal: "dairy" }, [["g", 50, 200, 50]]],
  ["yeast", "Dried yeast", "Baking", {}, [["g", 5, 10, 1]]],
  ["cornstarch", "Cornstarch", "Baking", {}, [["tbsp", 1, 2, 1]]],
  ["honey", "Honey", "Baking", { animal: "honey" }, [["tbsp", 1, 3, 1]]],
  ["maple-syrup", "Maple syrup", "Baking", {}, [["tbsp", 1, 3, 1]]],
  ["almond-flour", "Almond flour", "Baking", {}, [["g", 50, 200, 50]]],
  ["oats", "Rolled oats", "Baking", {}, [["g", 50, 150, 25], ["cup", 0.5, 1, 0.5]]],
  ["rice", "Rice", "Pantry", {}, [["g", 150, 400, 50], ["cup", 1, 2, 0.5]]],
  ["pasta", "Pasta", "Pantry", { gluten: true }, [["g", 200, 500, 50]]],
  ["spaghetti", "Spaghetti", "Pantry", { gluten: true }, [["g", 200, 500, 50]]],
  ["egg-noodles", "Egg noodles", "Pantry", { gluten: true, animal: "egg" }, [["g", 200, 400, 50]]],
  ["rice-noodles", "Rice noodles", "Pantry", {}, [["g", 150, 300, 50]]],
  ["quinoa", "Quinoa", "Pantry", {}, [["g", 100, 250, 50], ["cup", 0.5, 1, 0.5]]],
  ["lentils", "Red lentils", "Pantry", {}, [["g", 150, 300, 50]]],
  ["chickpeas", "Chickpeas", "Pantry", {}, [["can", 1, 2, 1]]],
  ["black-beans", "Black beans", "Pantry", {}, [["can", 1, 2, 1]]],
  ["coconut-milk", "Coconut milk", "Pantry", {}, [["can", 1, 1, 1], ["ml", 200, 400, 100]]],
  ["canned-tomatoes", "Canned tomatoes", "Pantry", {}, [["can", 1, 2, 1]]],
  ["tomato-paste", "Tomato paste", "Pantry", {}, [["tbsp", 1, 3, 1]]],
  ["vegetable-stock", "Vegetable stock", "Pantry", {}, [["ml", 250, 1000, 250], ["l", 0.5, 1, 0.5], ["cup", 1, 4, 1]]],
  ["chicken-stock", "Chicken stock", "Pantry", { animal: "meat" }, [["ml", 250, 1000, 250], ["l", 0.5, 1, 0.5]]],
  ["olive-oil", "Olive oil", "Pantry", {}, [["tbsp", 1, 4, 1], ["ml", 30, 100, 10]]],
  ["vegetable-oil", "Vegetable oil", "Pantry", {}, [["tbsp", 1, 3, 1]]],
  ["sesame-oil", "Sesame oil", "Pantry", {}, [["tsp", 1, 2, 1]]],
  ["soy-sauce", "Soy sauce", "Pantry", { gluten: true }, [["tbsp", 1, 4, 1]]],
  ["tamari", "Tamari", "Pantry", {}, [["tbsp", 1, 3, 1]]],
  ["fish-sauce", "Fish sauce", "Pantry", { animal: "fish" }, [["tbsp", 1, 2, 1]]],
  ["rice-vinegar", "Rice vinegar", "Pantry", {}, [["tbsp", 1, 2, 1]]],
  ["balsamic", "Balsamic vinegar", "Pantry", {}, [["tbsp", 1, 2, 1]]],
  ["peanut-butter", "Peanut butter", "Pantry", {}, [["tbsp", 2, 4, 1]]],
  ["tahini", "Tahini", "Pantry", {}, [["tbsp", 2, 4, 1]]],
  ["couscous", "Couscous", "Pantry", { gluten: true }, [["g", 150, 300, 50]]],
  ["breadcrumbs", "Breadcrumbs", "Pantry", { gluten: true }, [["g", 30, 100, 10], ["cup", 0.25, 0.5, 0.25]]],
  ["walnuts", "Walnuts", "Pantry", {}, [["g", 30, 100, 10]]],
  ["almonds", "Almonds", "Pantry", {}, [["g", 30, 100, 10]]],
  ["peanuts", "Peanuts", "Pantry", {}, [["g", 30, 100, 10]]],
  ["cashews", "Cashews", "Pantry", {}, [["g", 30, 100, 10]]],
  ["raisins", "Raisins", "Pantry", {}, [["g", 30, 80, 10]]],
  ["tofu", "Firm tofu", "Pantry", {}, [["g", 200, 400, 50]]],
  ["salt", "Salt", "Spices", {}, [[null], ["tsp", 0.5, 1, 0.5], ["pinch", 1, 1, 1]]],
  ["black-pepper", "Black pepper", "Spices", {}, [[null], ["tsp", 0.25, 1, 0.25]]],
  ["cumin", "Ground cumin", "Spices", {}, [["tsp", 0.5, 2, 0.5]]],
  ["paprika", "Paprika", "Spices", {}, [["tsp", 1, 2, 0.5]]],
  ["smoked-paprika", "Smoked paprika", "Spices", {}, [["tsp", 0.5, 2, 0.5]]],
  ["chili-flakes", "Chili flakes", "Spices", {}, [["tsp", 0.25, 1, 0.25], ["pinch", 1, 2, 1]]],
  ["turmeric", "Turmeric", "Spices", {}, [["tsp", 0.5, 1, 0.5]]],
  ["cinnamon", "Cinnamon", "Spices", {}, [["tsp", 0.5, 2, 0.5]]],
  ["oregano", "Dried oregano", "Spices", {}, [["tsp", 1, 2, 0.5]]],
  ["thyme", "Thyme", "Spices", {}, [["tsp", 1, 2, 0.5]]],
  ["rosemary", "Rosemary", "Spices", {}, [["tsp", 1, 2, 0.5]]],
  ["curry-powder", "Curry powder", "Spices", {}, [["tbsp", 1, 2, 1]]],
  ["garam-masala", "Garam masala", "Spices", {}, [["tsp", 1, 2, 0.5]]],
  ["nutmeg", "Nutmeg", "Spices", {}, [["pinch", 1, 2, 1]]],
  ["bay-leaf", "Bay leaves", "Spices", {}, [["piece", 1, 2, 1]]],
  ["mustard", "Dijon mustard", "Condiments", {}, [["tsp", 1, 2, 1], ["tbsp", 1, 2, 1]]],
  ["mayonnaise", "Mayonnaise", "Condiments", { animal: "egg" }, [["tbsp", 2, 4, 1]]],
  ["ketchup", "Ketchup", "Condiments", {}, [["tbsp", 1, 3, 1]]],
  ["sriracha", "Sriracha", "Condiments", {}, [["tsp", 1, 2, 1]]],
  ["miso", "White miso", "Condiments", {}, [["tbsp", 1, 2, 1]]],
  ["pesto", "Basil pesto", "Condiments", { animal: "dairy" }, [["tbsp", 2, 4, 1]]],
  ["frozen-peas", "Frozen peas", "Frozen", {}, [["g", 100, 300, 50], ["cup", 0.5, 1, 0.5]]],
  ["frozen-spinach", "Frozen spinach", "Frozen", {}, [["g", 200, 400, 100]]],
  ["puff-pastry", "Puff pastry", "Frozen", { gluten: true, animal: "dairy" }, [["piece", 1, 1, 1]]],
]

// Spanish names, densities (grams per US cup), weights of one piece, clove or can, and allergens.
// [es, gramsPerCup, gramsPerPiece, allergens]
const extra = {
  "onion": ["Cebolla", null, 150], "red-onion": ["Cebolla morada", null, 150], "garlic": ["Ajo", null, 5], "tomato": ["Tomate", 180, 120],
  "cherry-tomatoes": ["Tomates cherry", 150, 15], "potato": ["Patata", 150, 170], "sweet-potato": ["Boniato", 133, 200], "carrot": ["Zanahoria", 128, 70],
  "bell-pepper": ["Pimiento", 150, 160], "spinach": ["Espinacas", 30], "kale": ["Kale", 67], "lemon": ["Limón", null, 100], "lime": ["Lima", null, 65],
  "ginger": ["Jengibre", 96], "cilantro": ["Cilantro", 16], "parsley": ["Perejil", 60], "basil": ["Albahaca", 24], "mint": ["Menta", 48],
  "mushrooms": ["Champiñones", 70], "zucchini": ["Calabacín", 124, 200], "eggplant": ["Berenjena", 82, 300], "avocado": ["Aguacate", 150, 170],
  "cucumber": ["Pepino", 119, 300], "celery": ["Apio", 101, 40], "broccoli": ["Brócoli", 91], "cauliflower": ["Coliflor", 107], "cabbage": ["Col", 89],
  "leek": ["Puerro", 89, 180], "chili": ["Guindilla", null, 15], "jalapeno": ["Jalapeño", null, 14], "scallion": ["Cebolleta", 100, 15],
  "apple": ["Manzana", 125, 180], "banana": ["Plátano", 150, 120], "berries": ["Frutos rojos", 150], "mango": ["Mango", 165, 300],
  "lettuce": ["Lechuga", 47, 500], "corn": ["Maíz dulce", 154], "butternut": ["Calabaza", 140],
  "chicken-breast": ["Pechuga de pollo", 140, 200], "chicken-thigh": ["Muslos de pollo", 140, 110], "ground-beef": ["Carne picada de ternera", 225],
  "beef-steak": ["Filete de ternera", null, 250], "pork-shoulder": ["Paleta de cerdo", null], "bacon": ["Beicon", null, 25], "chorizo": ["Chorizo", 130],
  "lamb": ["Cordero", null], "salmon": ["Salmón", null, 150, ["fish"]], "cod": ["Bacalao", null, 150, ["fish"]], "shrimp": ["Gambas", 145, 12, ["shellfish"]],
  "egg": ["Huevos", 243, 50, ["egg"]], "butter": ["Mantequilla", 227, null, ["dairy"]], "milk": ["Leche", 245, null, ["dairy"]],
  "cream": ["Nata para montar", 238, null, ["dairy"]], "yogurt": ["Yogur griego", 245, null, ["dairy"]], "parmesan": ["Parmesano", 100, null, ["dairy"]],
  "mozzarella": ["Mozzarella", 112, 125, ["dairy"]], "feta": ["Feta", 150, null, ["dairy"]], "cheddar": ["Cheddar", 113, null, ["dairy"]],
  "ricotta": ["Ricotta", 246, null, ["dairy"]], "gruyere": ["Gruyère", 108, null, ["dairy"]], "bread": ["Pan", null, 35, ["gluten"]],
  "tortilla": ["Tortillas de trigo", null, 45, ["gluten"]], "pita": ["Pan de pita", null, 60, ["gluten"]], "baguette": ["Baguette", null, 250, ["gluten"]],
  "bun": ["Pan de hamburguesa", null, 75, ["gluten", "sesame"]], "corn-tortilla": ["Tortillas de maíz", null, 26], "flour": ["Harina de trigo", 125, null, ["gluten"]],
  "sugar": ["Azúcar", 200], "brown-sugar": ["Azúcar moreno", 220], "baking-powder": ["Levadura química", 230], "baking-soda": ["Bicarbonato", 220],
  "vanilla": ["Extracto de vainilla", 208], "cocoa": ["Cacao en polvo", 85], "chocolate": ["Chocolate negro", 170, null, ["dairy"]], "yeast": ["Levadura seca", 136],
  "cornstarch": ["Maicena", 128], "honey": ["Miel", 340], "maple-syrup": ["Sirope de arce", 315], "almond-flour": ["Harina de almendra", 96, null, ["nuts"]],
  "oats": ["Copos de avena", 90], "rice": ["Arroz", 185], "pasta": ["Pasta", 100, null, ["gluten"]], "spaghetti": ["Espaguetis", null, null, ["gluten"]],
  "egg-noodles": ["Fideos de huevo", 38, null, ["gluten", "egg"]], "rice-noodles": ["Fideos de arroz", 50], "quinoa": ["Quinoa", 170], "lentils": ["Lentejas rojas", 192],
  "chickpeas": ["Garbanzos", 164, 400], "black-beans": ["Alubias negras", 172, 400], "coconut-milk": ["Leche de coco", 226, 400], "canned-tomatoes": ["Tomate triturado", 240, 400],
  "tomato-paste": ["Concentrado de tomate", 262], "vegetable-stock": ["Caldo de verduras", 240], "chicken-stock": ["Caldo de pollo", 240],
  "olive-oil": ["Aceite de oliva", 216], "vegetable-oil": ["Aceite vegetal", 218], "sesame-oil": ["Aceite de sésamo", 218, null, ["sesame"]],
  "soy-sauce": ["Salsa de soja", 255, null, ["soy", "gluten"]], "tamari": ["Tamari", 255, null, ["soy"]], "fish-sauce": ["Salsa de pescado", 288, null, ["fish"]],
  "rice-vinegar": ["Vinagre de arroz", 240], "balsamic": ["Vinagre balsámico", 255], "peanut-butter": ["Crema de cacahuete", 258, null, ["peanuts"]],
  "tahini": ["Tahini", 240, null, ["sesame"]], "couscous": ["Cuscús", 173, null, ["gluten"]], "breadcrumbs": ["Pan rallado", 108, null, ["gluten"]],
  "walnuts": ["Nueces", 100, null, ["nuts"]], "almonds": ["Almendras", 143, null, ["nuts"]], "peanuts": ["Cacahuetes", 146, null, ["peanuts"]],
  "cashews": ["Anacardos", 137, null, ["nuts"]], "raisins": ["Pasas", 145], "tofu": ["Tofu firme", 252, null, ["soy"]],
  "salt": ["Sal", 288], "black-pepper": ["Pimienta negra", 116], "cumin": ["Comino molido", 96], "paprika": ["Pimentón", 109], "smoked-paprika": ["Pimentón ahumado", 109],
  "chili-flakes": ["Copos de guindilla", 85], "turmeric": ["Cúrcuma", 136], "cinnamon": ["Canela", 125], "oregano": ["Orégano seco", 48], "thyme": ["Tomillo", 46],
  "rosemary": ["Romero", 53], "curry-powder": ["Curry en polvo", 101], "garam-masala": ["Garam masala", 96], "nutmeg": ["Nuez moscada", 112],
  "bay-leaf": ["Laurel", null, 0.2], "mustard": ["Mostaza de Dijon", 250, null, ["mustard"]], "mayonnaise": ["Mayonesa", 220, null, ["egg"]],
  "ketchup": ["Kétchup", 270], "sriracha": ["Sriracha", 270], "miso": ["Miso blanco", 275, null, ["soy"]], "pesto": ["Pesto de albahaca", 260, null, ["dairy", "nuts"]],
  "frozen-peas": ["Guisantes congelados", 145], "frozen-spinach": ["Espinacas congeladas", 190], "puff-pastry": ["Hojaldre", null, 275, ["gluten", "dairy"]],
}
const ingredients = catalog.map(([id, name, aisle, flags]) => {
  const [es, gramsPerCup, gramsPerPiece, allergens] = extra[id] ?? []
  if (!es) throw new Error(`No Spanish name for ${id}.`)
  const allAllergens = [...new Set([...(allergens ?? []), ...(flags.gluten ? ["gluten"] : [])])].sort()
  return {
    id,
    name,
    names: { es },
    aisle,
    ...(flags.animal ? { animal: flags.animal } : {}),
    ...(flags.gluten ? { gluten: true } : {}),
    ...(allAllergens.length ? { allergens: allAllergens } : {}),
    ...(gramsPerCup ? { gramsPerCup } : {}),
    ...(gramsPerPiece ? { gramsPerPiece } : {}),
  }
})
const byId = new Map(catalog.map(entry => [entry[0], entry]))

const cuisines = {
  Italian: { cores: [["pasta", "Pasta"], ["spaghetti", "Spaghetti"], ["mushrooms", "Risotto"], ["mozzarella", "Bake"], ["eggplant", "Parmigiana"]], extras: ["garlic", "olive-oil", "basil", "parmesan", "tomato", "canned-tomatoes", "oregano", "onion", "salt", "black-pepper", "balsamic"] },
  Mexican: { cores: [["tortilla", "Tacos"], ["corn-tortilla", "Tacos"], ["black-beans", "Burrito Bowl"], ["tortilla", "Quesadillas"], ["corn", "Enchiladas"]], extras: ["lime", "cilantro", "jalapeno", "avocado", "cumin", "chili", "onion", "red-onion", "tomato", "salt", "smoked-paprika"] },
  Indian: { cores: [["lentils", "Dal"], ["chickpeas", "Chana Masala"], ["rice", "Biryani"], ["cauliflower", "Curry"], ["spinach", "Saag"]], extras: ["garam-masala", "turmeric", "cumin", "ginger", "garlic", "onion", "coconut-milk", "cilantro", "chili", "salt", "yogurt", "canned-tomatoes"] },
  Thai: { cores: [["rice-noodles", "Noodles"], ["coconut-milk", "Curry"], ["rice", "Fried Rice"], ["shrimp", "Stir-Fry"], ["tofu", "Stir-Fry"]], extras: ["fish-sauce", "lime", "chili", "garlic", "ginger", "cilantro", "scallion", "peanuts", "sesame-oil", "brown-sugar", "bell-pepper"] },
  Japanese: { cores: [["rice", "Donburi"], ["salmon", "Teriyaki"], ["tofu", "Miso Soup"], ["egg-noodles", "Ramen"], ["rice", "Onigiri"]], extras: ["soy-sauce", "miso", "ginger", "scallion", "sesame-oil", "rice-vinegar", "garlic", "sugar", "carrot", "cucumber"] },
  Chinese: { cores: [["egg-noodles", "Lo Mein"], ["rice", "Fried Rice"], ["pork-shoulder", "Char Siu"], ["tofu", "Mapo Tofu"], ["broccoli", "Stir-Fry"]], extras: ["soy-sauce", "ginger", "garlic", "scallion", "sesame-oil", "cornstarch", "chili-flakes", "rice-vinegar", "brown-sugar", "bell-pepper"] },
  French: { cores: [["chicken-thigh", "Fricassée"], ["potato", "Gratin"], ["leek", "Quiche"], ["butter", "Galette"], ["mushrooms", "Tartine"]], extras: ["butter", "cream", "thyme", "garlic", "gruyere", "mustard", "onion", "egg", "salt", "black-pepper", "parsley"] },
  Mediterranean: { cores: [["chickpeas", "Bowl"], ["couscous", "Salad"], ["feta", "Salad"], ["pita", "Wraps"], ["lamb", "Kebabs"]], extras: ["olive-oil", "lemon", "cucumber", "tomato", "red-onion", "mint", "parsley", "garlic", "oregano", "tahini", "yogurt", "salt"] },
  American: { cores: [["ground-beef", "Burgers"], ["chicken-breast", "Sandwich"], ["potato", "Hash"], ["cheddar", "Mac and Cheese"], ["oats", "Pancakes"]], extras: ["bun", "cheddar", "ketchup", "mustard", "onion", "butter", "milk", "egg", "bacon", "salt", "black-pepper", "lettuce"] },
  Spanish: { cores: [["chorizo", "Stew"], ["rice", "Paella"], ["potato", "Tortilla"], ["shrimp", "Gambas"], ["chickpeas", "Stew"]], extras: ["smoked-paprika", "garlic", "olive-oil", "onion", "bell-pepper", "tomato", "parsley", "lemon", "salt", "bay-leaf"] },
  Korean: { cores: [["rice", "Bibimbap"], ["beef-steak", "Bulgogi"], ["tofu", "Stew"], ["cabbage", "Pancake"], ["chicken-thigh", "Fried Chicken"]], extras: ["soy-sauce", "garlic", "ginger", "sesame-oil", "scallion", "sugar", "egg", "carrot", "spinach", "chili-flakes"] },
  "Middle Eastern": { cores: [["chickpeas", "Hummus Plate"], ["lentils", "Soup"], ["eggplant", "Baba Ganoush"], ["lamb", "Kofta"], ["bulgur", "Tabbouleh"]], extras: ["tahini", "lemon", "garlic", "cumin", "olive-oil", "parsley", "mint", "pita", "yogurt", "salt", "tomato"] },
}

const styles = ["Smoky", "Lemony", "Crispy", "Spicy", "Creamy", "Herby", "Garlicky", "Weeknight", "One-Pan", "Slow-Cooked", "Charred", "Golden", "Zesty", "Hearty", "Simple", "Sticky", "Roasted", "Quick", "Rustic", "Sunday", "Summer", "Winter", "Ginger", "Honey-Glazed", "Sesame", "Chili", "Coconut", "Green", "Tangy", "Toasted"]
const breakfast = [["Overnight Oats", ["oats", "milk", "berries", "maple-syrup", "cinnamon"]], ["Pancakes", ["flour", "milk", "egg", "butter", "sugar", "baking-powder", "salt"]], ["Shakshuka", ["egg", "canned-tomatoes", "bell-pepper", "onion", "cumin", "paprika", "olive-oil", "salt"]], ["Avocado Toast", ["bread", "avocado", "lemon", "chili-flakes", "salt"]], ["Granola Bowl", ["oats", "yogurt", "honey", "almonds", "berries"]], ["Frittata", ["egg", "spinach", "feta", "onion", "olive-oil", "salt", "black-pepper"]], ["Smoothie Bowl", ["banana", "berries", "yogurt", "oats", "honey"]], ["Breakfast Burrito", ["tortilla", "egg", "black-beans", "cheddar", "avocado", "salt"]], ["French Toast", ["bread", "egg", "milk", "cinnamon", "butter", "maple-syrup"]], ["Porridge", ["oats", "milk", "banana", "cinnamon", "maple-syrup"]]]
const desserts = [["Brownies", ["chocolate", "butter", "sugar", "egg", "flour", "cocoa", "salt"]], ["Apple Crumble", ["apple", "flour", "butter", "brown-sugar", "oats", "cinnamon"]], ["Banana Bread", ["banana", "flour", "sugar", "egg", "butter", "baking-soda", "salt"]], ["Chocolate Mousse", ["chocolate", "egg", "cream", "sugar"]], ["Berry Galette", ["flour", "butter", "berries", "sugar", "lemon", "salt"]], ["Rice Pudding", ["rice", "milk", "sugar", "vanilla", "cinnamon"]], ["Mango Lassi", ["mango", "yogurt", "milk", "sugar"]], ["Almond Cake", ["almond-flour", "egg", "sugar", "butter", "lemon", "baking-powder"]]]
const soups = [["Tomato Soup", ["canned-tomatoes", "onion", "garlic", "vegetable-stock", "cream", "basil", "salt"]], ["Lentil Soup", ["lentils", "carrot", "onion", "celery", "vegetable-stock", "cumin", "salt"]], ["Minestrone", ["pasta", "carrot", "celery", "zucchini", "canned-tomatoes", "vegetable-stock", "parmesan"]], ["Chicken Noodle Soup", ["chicken-breast", "egg-noodles", "carrot", "celery", "chicken-stock", "thyme", "salt"]], ["Butternut Soup", ["butternut", "onion", "vegetable-stock", "coconut-milk", "ginger", "salt"]], ["Leek and Potato Soup", ["leek", "potato", "butter", "vegetable-stock", "cream", "salt"]]]
const salads = [["Caesar Salad", ["lettuce", "parmesan", "bread", "egg", "mustard", "lemon", "olive-oil"]], ["Greek Salad", ["tomato", "cucumber", "feta", "red-onion", "olive-oil", "oregano"]], ["Quinoa Salad", ["quinoa", "cucumber", "cherry-tomatoes", "parsley", "lemon", "olive-oil", "salt"]], ["Kale Salad", ["kale", "lemon", "olive-oil", "parmesan", "walnuts", "salt"]], ["Noodle Salad", ["rice-noodles", "carrot", "cucumber", "mint", "lime", "peanuts", "fish-sauce"]]]
const snacks = [["Hummus", ["chickpeas", "tahini", "lemon", "garlic", "olive-oil", "salt"]], ["Guacamole", ["avocado", "lime", "red-onion", "cilantro", "jalapeno", "salt"]], ["Roasted Nuts", ["almonds", "cashews", "smoked-paprika", "olive-oil", "salt"]], ["Energy Bites", ["oats", "peanut-butter", "honey", "raisins"]], ["Bruschetta", ["baguette", "tomato", "basil", "garlic", "olive-oil", "salt"]]]

// Recipes whose names have accents, ligatures or letters outside A to Z. Search must find them typed without accents,
// and an A to Z sort must put them among their base letter.
const special = [
  ["Crème Brûlée", "French", "dessert", ["cream", "egg", "sugar", "vanilla"]],
  ["Crêpes Suzette", "French", "dessert", ["flour", "egg", "milk", "butter", "sugar", "lemon"]],
  ["Gratin Dauphinois", "French", "side", ["potato", "cream", "milk", "garlic", "gruyere", "nutmeg", "salt"]],
  ["Œufs en Cocotte", "French", "breakfast", ["egg", "cream", "spinach", "butter", "salt", "black-pepper"]],
  ["Tarte Flambée", "French", "main", ["flour", "cream", "bacon", "onion", "yeast", "salt"]],
  ["Gâteau Basque", "French", "dessert", ["flour", "butter", "sugar", "egg", "almond-flour", "vanilla"]],
  ["Jalapeño Poppers", "Mexican", "snack", ["jalapeno", "cheddar", "bacon", "breadcrumbs"]],
  ["Piña Colada Smoothie", "American", "breakfast", ["mango", "coconut-milk", "banana", "lime"]],
  ["Açaí Bowl", "American", "breakfast", ["berries", "banana", "oats", "honey", "almonds"]],
  ["Bún Chả", "Vietnamese", "main", ["pork-shoulder", "rice-noodles", "fish-sauce", "lime", "garlic", "mint", "brown-sugar", "lettuce"]],
  ["Phở Bò", "Vietnamese", "soup", ["beef-steak", "rice-noodles", "ginger", "onion", "fish-sauce", "cinnamon", "cilantro", "lime", "chicken-stock"]],
  ["Bánh Mì", "Vietnamese", "main", ["baguette", "pork-shoulder", "carrot", "cucumber", "cilantro", "mayonnaise", "chili", "rice-vinegar"]],
  ["Smørrebrød", "Nordic", "main", ["bread", "salmon", "butter", "cucumber", "lemon", "egg"]],
  ["Rødgrød med Fløde", "Nordic", "dessert", ["berries", "sugar", "cornstarch", "cream"]],
  ["Käsespätzle", "German", "main", ["flour", "egg", "milk", "gruyere", "onion", "butter", "salt"]],
  ["Rösti", "Swiss", "side", ["potato", "butter", "salt", "black-pepper"]],
  ["Ćevapi", "Balkan", "main", ["ground-beef", "lamb", "garlic", "paprika", "onion", "pita", "salt"]],
  ["Pão de Queijo", "Brazilian", "snack", ["cornstarch", "milk", "egg", "parmesan", "vegetable-oil", "salt"]],
  ["Ñoquis de Papa", "Argentinian", "main", ["potato", "flour", "egg", "parmesan", "butter", "salt"]],
  ["Çılbır", "Turkish", "breakfast", ["egg", "yogurt", "garlic", "butter", "chili-flakes", "salt"]],
  ["Moussaká", "Greek", "main", ["eggplant", "ground-beef", "onion", "canned-tomatoes", "milk", "butter", "flour", "cinnamon"]],
  ["Spanakópita", "Greek", "main", ["spinach", "feta", "egg", "onion", "puff-pastry", "dill-free"]],
  ["Paella Valenciana", "Spanish", "main", ["rice", "chicken-thigh", "bell-pepper", "smoked-paprika", "chicken-stock", "tomato", "olive-oil", "lemon"]],
  ["Crème Fraîche Pancakes", "French", "breakfast", ["flour", "cream", "egg", "milk", "sugar", "baking-powder", "butter"]],
  ["Croque Monsieur", "French", "main", ["bread", "gruyere", "butter", "milk", "flour", "mustard"]],
  ["Crispy Chickpea Wraps", "Mediterranean", "main", ["chickpeas", "pita", "yogurt", "cucumber", "smoked-paprika", "lemon", "olive-oil"]],
]

const courses = ["main", "main", "main", "main", "breakfast", "dessert", "soup", "salad", "snack", "side"]
const stepTemplates = {
  main: [
    "Prep everything: chop the vegetables and measure out the rest.",
    "Heat the oil in a large pan over medium-high heat.",
    "Cook the {core} for {n} minutes, stirring now and then, until browned.",
    "Add the aromatics and cook for 1 minute until fragrant.",
    "Stir in the remaining ingredients and simmer for {n} minutes.",
    "Taste, season with salt and pepper, and adjust the acidity.",
    "Rest for 5 minutes, then serve.",
  ],
  breakfast: ["Get everything ready the night before if you can.", "Mix the base ingredients in a bowl.", "Cook or assemble in {n} minutes.", "Top and serve right away."],
  dessert: ["Heat the oven to 180 °C (350 °F) and line a tin.", "Whisk the wet ingredients together.", "Fold in the dry ingredients until just combined.", "Bake for {n} minutes, until set but still a little soft in the middle.", "Cool completely before slicing."],
  soup: ["Sweat the aromatics in a large pot for 8 minutes.", "Add the rest and bring to a boil.", "Simmer for {n} minutes until everything is tender.", "Blend until smooth, or leave it chunky.", "Season and serve hot."],
  salad: ["Wash and dry the greens.", "Whisk the dressing in a jar.", "Toss everything together just before serving."],
  snack: ["Blend or mix everything until smooth.", "Season to taste.", "Serve with something crunchy."],
  side: ["Prep the vegetables.", "Roast or pan-fry for {n} minutes.", "Season and serve."],
}

function amount(id) {
  const entry = byId.get(id)
  if (!entry) return null
  const option = pick(entry[4])
  if (option[0] === null) return { ingredient: id, quantity: null, unit: null }
  const [unit, min, max, step] = option
  const steps = Math.round((max - min) / step)
  const quantity = Math.round((min + between(0, steps) * step) * 1000) / 1000
  return { ingredient: id, quantity, unit }
}

// Cup amounts in recipes also come as thirds, which an app has to show as ⅓ and ⅔.
function withThirds(line) {
  if (line.unit === "cup" && random() < 0.25) return { ...line, quantity: pick([1 / 3, 2 / 3, 4 / 3]) }
  return line
}

function dietsOf(ids) {
  const animals = ids.map(id => byId.get(id)?.[3].animal).filter(Boolean)
  const diets = []
  if (!animals.includes("meat") && !animals.includes("fish")) diets.push("vegetarian")
  if (!animals.length) diets.push("vegan")
  if (!ids.some(id => byId.get(id)?.[3].gluten)) diets.push("gluten-free")
  if (!animals.includes("dairy")) diets.push("dairy-free")
  return diets
}

const notes = { garlic: "minced", onion: "diced", "red-onion": "thinly sliced", parsley: "chopped", cilantro: "chopped", butter: "softened", lemon: "juiced", lime: "juiced", ginger: "grated", parmesan: "grated" }

function build(id, title, cuisine, course, ids) {
  const lines = [...new Set(ids)].filter(name => byId.has(name)).map(amount).filter(Boolean).map(withThirds)
    .map(line => notes[line.ingredient] && random() < 0.5 ? { ...line, note: notes[line.ingredient] } : line)
  const minutes = course === "salad" || course === "snack" ? between(5, 25) : course === "dessert" ? between(25, 90) : course === "breakfast" ? between(5, 35) : between(15, 240)
  const steps = stepTemplates[course === "main" ? "main" : course].map(step => step.replace("{core}", (byId.get(ids[0])?.[1] ?? "main ingredient").toLowerCase()).replace("{n}", String(Math.max(2, Math.round(minutes / 4)))))
  const created = new Date(Date.UTC(2019, 0, 1) + between(0, 6 * 365) * 86_400_000)
  return {
    id,
    title,
    description: `${course === "dessert" ? "A sweet" : course === "breakfast" ? "An easy morning" : "A"} ${cuisine.toLowerCase()} ${course === "main" ? "dish" : course} with ${lines.slice(0, 3).map(line => byId.get(line.ingredient)[1].toLowerCase()).join(", ")}.`,
    cuisine,
    course,
    diets: dietsOf(lines.map(line => line.ingredient)),
    minutes,
    servings: pick([1, 2, 2, 4, 4, 4, 4, 6, 6, 8, 12]),
    caloriesPerServing: between(course === "salad" ? 150 : 250, course === "dessert" ? 650 : 900),
    rating: Math.round((3 + random() * 2) * 10) / 10,
    ratingCount: between(0, 2400),
    createdAt: created.toISOString().slice(0, 10),
    ingredients: lines,
    steps,
  }
}

const recipes = []
const titles = new Set()
const total = 20500
const sides = ["Lime Rice", "Garlic Bread", "Greens", "Crispy Potatoes", "Flatbread", "Pickled Onions", "Herb Salad", "Yogurt Sauce", "Chili Oil", "Toasted Seeds", "Charred Corn", "Coconut Rice", "Slaw", "Roasted Peppers", "Salsa Verde", "Brown Butter", "Miso Glaze", "Lemon Crumbs", "Cucumber Salad", "Peanut Sauce"]
const specialAt = new Map(special.map((entry, index) => [index === 0 ? 123 : 40 + index * 89, entry]))
// The old site linked /#/recipe/123: the rubric's example. Recipe 123 is Crème Brûlée.
for (let id = 1; recipes.length < total; id++) {
  const fixed = specialAt.get(id)
  if (fixed) {
    recipes.push(build(id, fixed[0], fixed[1], fixed[2], fixed[3]))
    titles.add(fixed[0])
    continue
  }
  const course = pick(courses)
  const cuisine = pick(Object.keys(cuisines))
  const { cores, extras } = cuisines[cuisine]
  let title
  let ids
  if (course === "main") {
    const [core, dish] = pick(cores)
    title = `${pick(styles)} ${dish}`
    const protein = random() < 0.6 ? pick(["chicken-breast", "chicken-thigh", "ground-beef", "salmon", "shrimp", "tofu", "chickpeas", "lentils", "pork-shoulder", "mushrooms", "cod", "black-beans"]) : null
    if (protein) title = `${pick(styles)} ${byId.get(protein)[1].replace(/ (fillet|breast|thighs|shoulder)$/i, "")} ${dish}`
    ids = [core, ...(protein ? [protein] : []), ...sample(extras, between(4, 8))]
  }
  else {
    const pool = { breakfast, dessert: desserts, soup: soups, salad: salads, snack: snacks, side: [["Roasted Vegetables", ["carrot", "potato", "olive-oil", "rosemary", "salt"]], ["Garlic Rice", ["rice", "garlic", "butter", "salt"]], ["Slaw", ["cabbage", "carrot", "mayonnaise", "rice-vinegar", "salt"]], ["Green Beans", ["broccoli", "garlic", "almonds", "lemon", "olive-oil"]]] }[course]
    const [dish, base] = pick(pool)
    title = `${pick(styles)} ${dish}`
    ids = [...base, ...sample(extras, between(0, 2))]
  }
  for (let attempt = 0; titles.has(title) && attempt < 6; attempt++) title = `${title.split(" with ")[0]} with ${pick(sides)}`
  for (let n = 2; titles.has(title); n++) title = `${title.replace(/ \d+$/, "")} ${n}`
  titles.add(title)
  recipes.push(build(id, title, cuisine, course, ids))
}
// Ids have gaps, like a real export: every 97th recipe was deleted from the old site.
const kept = recipes.filter(recipe => recipe.id % 97 !== 0 || recipe.id === 123)

const out = join(import.meta.dirname, "fixture/data")
mkdirSync(out, { recursive: true })
writeFileSync(join(out, "ingredients.json"), `${JSON.stringify(ingredients, null, 2)}\n`)
writeFileSync(join(out, "recipes.json"), `${JSON.stringify(kept)}\n`)
console.log(`${kept.length} recipes, ${ingredients.length} ingredients`)
