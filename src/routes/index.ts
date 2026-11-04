import { Router } from "express";
import { createHero, getAllHeroes, getHeroById } from "../controllers/hero.controller";
import { getAllSkins, getSkinById } from "../controllers/skin.controller";
import {
  buyHero,
  createPlayer,
  deletePlayer,
  getPlayerById,
  playMatch,
  topUp,
  updatePlayer,
} from "../controllers/player.controller";
import { getStatistics } from "../controllers/statistics.controller";

const router = Router();

// Fitur 2: Hero
router.get("/heroes", getAllHeroes);
router.get("/heroes/:hero_id", getHeroById);
router.post("/heroes", createHero);

// Fitur 3: Skin
router.get("/skins", getAllSkins);
router.get("/skins/:skin_id", getSkinById);

router.post("/players", createPlayer);
router.get("/players/:player_id", getPlayerById);
router.patch("/players/:player_id", updatePlayer);
router.delete("/players/:player_id", deletePlayer);
router.post("/players/:player_id/topup", topUp);
router.post("/players/:player_id/matches", playMatch);
router.post("/players/:player_id/heroes", buyHero);

router.get("/statistics", getStatistics);

export default router;
