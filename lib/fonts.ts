// Poppins 600 is used only to paint the printed logo onto the 3D model (not on the page).
import { Poppins } from "next/font/google";

export const poppins = Poppins({ weight: "600", subsets: ["latin"], preload: false, display: "swap" });
