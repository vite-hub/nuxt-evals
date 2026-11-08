export default defineAppConfig({
  ui: {
    colors: {
      primary: "brand",
      neutral: "zinc",
    },
    button: {
      // Nuxt UI darkens a solid button on hover with 75% opacity, which drops white text on the light-mode green
      // to 3.4:1. Use solid shades instead: 800 behind white text (6.3:1), 400 behind dark text in dark mode.
      compoundVariants: [{
        color: "primary",
        variant: "solid",
        class: "hover:bg-(--ui-color-primary-800) active:bg-(--ui-color-primary-800) dark:hover:bg-(--ui-color-primary-400) dark:active:bg-(--ui-color-primary-400)",
      }],
    },
  },
})
