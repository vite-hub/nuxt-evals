export default defineAppConfig({
  ui: {
    colors: {
      // Wrong: Tailwind's green is close to the brand color, but not #00DC82.
      primary: "green",
      neutral: "zinc",
    },
  },
})
