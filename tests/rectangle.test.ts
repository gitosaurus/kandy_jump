declare function require(path: string): any;
const assert = require('assert');
import { Rectangle, rectanglesIntersect } from '../kandy_jump';

const r1 = new Rectangle(0, 0, 10, 10);
const r2 = new Rectangle(5, 5, 10, 10);
assert.strictEqual(rectanglesIntersect(r1, r2), true, 'overlapping rectangles should intersect');

const r3 = new Rectangle(20, 20, 5, 5);
assert.strictEqual(rectanglesIntersect(r1, r3), false, 'non-overlapping rectangles should not intersect');

console.log('rectangle tests passed');

