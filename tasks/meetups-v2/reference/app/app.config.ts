export default defineAppConfig({
  ui: {
    colors: {
      primary: "brand",
      neutral: "zinc",
    },
    // Nuxt UI's placeholder color (dimmed) is 2.6:1 on white. Muted reads at 4.8:1 light, 6.8:1 dark.
    input: { slots: { base: "placeholder:text-muted" } },
    textarea: { slots: { base: "placeholder:text-muted" } },
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
