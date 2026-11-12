build me a meal planner as a vue app: vue 3, vue router 5 and vite, in typescript. no backend, everything runs in the browser and stays on the device. stick to vue's own packages (vueuse is fine), no pinia. experimental features (vue router's data loaders, newer browser apis) are fine when they help. the recipes are in data/ (about 20,000 of them, see data/README.md), and it has to feel fast on a cheap android phone

people browse and search recipes (typing "creme brulee" has to find "Crème Brûlée"), filter by diet, cuisine and max time, and sort them. filters go in the url so a shared link opens the same list and back works. on a recipe they change the servings and the amounts follow, switch between metric and us units, and see amounts like a cookbook (1 ½ cups, not 1.5 cups)

they plan their week: put recipes on days (breakfast, lunch, dinner) by dragging, on a phone too, and with the keyboard, with undo and redo. weeks start on monday and they can go back and forward. show the calories of each day

households: they add the people they cook for, with their diets and allergies. each meal says who's eating, the amounts follow, and the app warns when a meal doesn't suit someone at the table

a week gets a shopping list: the same ingredient added up across recipes even when one recipe uses grams and another cups (the data has densities), grouped by aisle, tick things off. they keep a pantry with how much they have (500 g flour, 6 eggs) and the list only asks for what's missing. print it

they can add their own recipes with a form (ingredient rows, steps), edit and delete them, and don't lose a half-filled form if they click away by accident

they share a week with a link: whoever opens it sees that week read-only and can copy it into their own plan

english and spanish, picked by the user and kept in the url

everything is still there after a reload, two open tabs stay in sync, and they can export all their data to a file and import it back. it works offline once it's been opened, and when we ship a new version people are told and nothing they were doing is lost. the old version had links like /#/recipe/123 and /#/plan, those have to keep working

our color is #e4572e, dark mode too. make it accessible and production ready with tests
