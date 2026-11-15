// Registry of all animals, in switcher order.
// To add one: create a module like butterfly.js and list it here.
import butterfly from './butterfly.js';
import jellyfish from './jellyfish.js';
import dragonfly from './dragonfly.js';
import koi from './koi.js';
import frog from './frog.js';
import crane from './crane.js';
import crab from './crab.js';

export const ANIMALS = [butterfly, jellyfish, dragonfly, koi, frog, crane, crab];

export const DEFAULT_ANIMAL = 'butterfly';

export function byId(id) {
  return ANIMALS.find(a => a.id === id) ?? ANIMALS[0];
}
