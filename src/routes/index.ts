import { Router } from "express";
import { createHero, getAllHeroes, getHeroById } from "../controllers/hero.controller";
import { getAllSkins, getSkinById } from "../controllers/skin.controller";

const router = Router();

// Fitur 2: Hero
router.get("/heroes", getAllHeroes);
router.get("/heroes/:hero_id", getHeroById);
router.post("/heroes", createHero);

// Fitur 3: Skin
router.get("/skins", getAllSkins);
router.get("/skins/:skin_id", getSkinById);

export default router;
