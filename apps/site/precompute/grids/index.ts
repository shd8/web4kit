import type { Grid } from "../grid";
import { hotel } from "./hotel";
import { restaurant } from "./restaurant";
import { welcome } from "./welcome";

export const GRIDS: Record<Grid["site"], Grid> = { restaurant, hotel, welcome };
