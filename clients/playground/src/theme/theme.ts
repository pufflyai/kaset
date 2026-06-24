import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

import { globalCss } from "./global";
import { colors } from "./primitives/colors";
import { fontSizes, fonts, fontWeights } from "./primitives/fonts";
import { radii, spacing } from "./primitives/sizes";
import { alertSlotRecipe } from "./recipes/alert";
import { buttonRecipe } from "./recipes/button";
import { dialogSlotRecipe } from "./recipes/dialog";
import { dividerRecipe } from "./recipes/divider";
import { drawerSlotRecipe } from "./recipes/drawer";
import { editableSlotRecipe } from "./recipes/editable";
import { fieldsetSlotRecipe } from "./recipes/form";
import { inputRecipe } from "./recipes/input";
import { menuSlotRecipe } from "./recipes/menu";
import { popoverRecipe } from "./recipes/popover";
import { progressCircleSlotRecipe } from "./recipes/progress-circle";
import { skeletonRecipe } from "./recipes/skeleton";
import { textareaRecipe } from "./recipes/textarea";
import { tooltipRecipe } from "./recipes/tooltip";
import { borders } from "./tokens/borders";
import { semanticColors } from "./tokens/colors";
import { layerStyles } from "./tokens/layer-styles";
import { semanticShadows, shadows } from "./tokens/shadows";
import { textStyles } from "./tokens/text";

const config = defineConfig({
  globalCss,
  theme: {
    textStyles,
    layerStyles,
    recipes: {
      button: buttonRecipe,
      divider: dividerRecipe,
      input: inputRecipe,
      skeleton: skeletonRecipe,
      textarea: textareaRecipe,
    },
    tokens: {
      colors,
      fonts,
      fontSizes,
      fontWeights,
      radii,
      shadows,
      spacing,
    },
    semanticTokens: {
      colors: semanticColors,
      borders,
      shadows: semanticShadows,
    },
    slotRecipes: {
      alert: alertSlotRecipe,
      drawer: drawerSlotRecipe,
      tooltip: tooltipRecipe,
      popover: popoverRecipe,
      menu: menuSlotRecipe,
      editable: editableSlotRecipe,
      form: fieldsetSlotRecipe,
      dialog: dialogSlotRecipe,
      progressCircle: progressCircleSlotRecipe,
    },
  },
});

export default createSystem(defaultConfig, config);
