function random_int(range: number): number {
    return Math.floor(Math.random() * range);
}

function text_height(text_box: TextMetrics): number {
    return text_box.actualBoundingBoxAscent + text_box.actualBoundingBoxDescent;
}

class Rectangle {
    constructor(
        public left: number,
        public top: number,
        public width: number,
        public height: number,
        public right = left + width,
        public bottom = top + height
    ) {}
}
// From:
// https://stackoverflow.com/questions/2752349/fast-rectangle-to-rectangle-intersection#2752387
function rectanglesIntersect(r1: Rectangle, r2: Rectangle): boolean {
    return !(r2.left > r1.right || 
             r2.right < r1.left || 
             r2.top > r1.bottom ||
             r2.bottom < r1.top);
}

class MainGame {
    worldHeight: number;
    worldWidth: number;
    timerId: any = null;
    endTime: number = 0;
    player: Player = null;
    constructor(
        public hiScore = 0,
        public totalScore = 0,
        public flashScore = 10,
        public flashMilestone = flashScore,
        public levelSeconds = 60,
        public layers = new Array<Array<Sprite>>(),
        public allSprites = new Array<Sprite>(),
        public pressingLeft = false,
        public pressingRight = false) {}
    paint () {
        var ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        this.worldHeight = canvas.height;
        this.worldWidth = canvas.width;
        if (this.player == null) {
            this.startLevel();
            return;
        }
        this.layers.forEach((lyr) => {
            lyr.forEach((sprite) => {
                sprite.draw();
            });
        });
        // Write the score.  Am doing this in three parts,
        // simply to justify each one separately.
        ctx.font = 'bold 14px sans-serif';
        ctx.fillStyle = '#000000';
        var score_str = 'Score: ' + this.totalScore;
        var text_box = ctx.measureText(score_str);

        // NOTE:  Only using one value of text_h
        // throughout, in order to ensure that all the
        // text baselines line up perfectly.  Otherwise
        // tiny differences in numeral vs. alpha height,
        // or ascenders vs. descenders, make visually
        // annoying differences.
        var text_h = text_height(text_box);
        ctx.fillText(score_str, 10, 10 + text_h);
        
        score_str = 'Hi Score: ' + this.hiScore;
        text_box = ctx.measureText(score_str);
        var text_w = text_box.width;
        ctx.fillText(score_str, this.worldWidth/2 - text_w/2 - 10, 10 + text_h);

        // See if the game is over
        var now = new Date().getTime();
        if (now >= this.endTime) {
            this.stop();
            var game_over = 'Game Over!';
            text_box = ctx.measureText(game_over);
            text_w = text_box.width;
            ctx.fillText(game_over,
                this.worldWidth/2 - text_w/2,
                this.worldHeight/2 - text_h - 2);
        } else {
            var timer_str = 'Time Left: ' + Math.floor((this.endTime - now) / 1000);
            text_box = ctx.measureText(timer_str);
            text_w = text_box.width;
            ctx.fillText(timer_str,
                this.worldWidth - 10 - text_w,
                10 + text_h);
        }
    }
    addSprite(s: Sprite, layer_index: number) {
        this.allSprites.push(s);
        var layer = this.layers[layer_index];
        layer.push(s);
        s.layer = layer;
    }
    start() {
        this.totalScore = 0;
        this.flashMilestone = this.flashScore;
        this.endTime = new Date().getTime() + 1000 * this.levelSeconds;
        this.layers = null;
        this.allSprites = null;
        this.player = null;  // signal to rebuild level
    }
    stop() {
        clearInterval(this.timerId);
        this.timerId = null;
    }
    startLevel() {
        this.allSprites = new Array<Sprite>();
        this.layers = [
            new Array<Sprite>(),
            new Array<Sprite>(),
            new Array<Sprite>()
        ];
        
        this.player = new Player();
        this.addSprite(this.player, 2);  // in front of everything
        
        var cloud1 = new Cloud(1); cloud1.vx = -(random_int(3) + 1);
        var cloud2 = new Cloud(2); cloud2.vx = random_int(3) + 1;
        this.addSprite(cloud1, 1);
        this.addSprite(cloud2, 1);
    }
    cycle() {
        if (this.player) {
            if (this.pressingLeft) this.player.left();
            if (this.pressingRight) this.player.right();
        }
        var nextSprites = [];
        // The updates inside this loop may add to allSprites,
        // so the choice to continue the loop until the very end of
        // allSprites.size() is in fact critical; otherwise they
        // won't make it into next_sprites.
        // In other words, changing this to forEach will cause a
        // problem.
        if (this.allSprites) {
            for (var ii = 0; ii < this.allSprites.length; ii++) {
                var s = this.allSprites[ii];
                if (s.inPlay) {
                    s.update();
                    nextSprites.push(s);
                } else {
                    // Remove sprite from its render layer. The previous
                    // implementation replaced the layer array reference, which
                    // left the old array (still referenced by mainGame.layers)
                    // untouched. This caused layers to grow with inactive
                    // sprites. Splicing ensures the shared layer array is
                    // mutated in place.
                    const idx = s.layer.indexOf(s);
                    if (idx !== -1) {
                        s.layer.splice(idx, 1);
                    }
                }
            }
        }
        this.allSprites = nextSprites;
        this.paint();
    }
    jump() {
        if (this.player) this.player.jump();
    }
    updateScore(next_score: number) {
        this.totalScore = next_score;
        this.hiScore = Math.max(this.totalScore, this.hiScore);
    }
}

class Sprite {
    constructor(
        public width = 0,
        public height = 0,
        public image: HTMLImageElement = null,
        public x = 50,
        public y = 50,
        public vx = 0,
        public vy = 0,
        public grounded = false,
        public solid = true,
        public hitScore = 0,
        public inPlay = true,
        public gravity = 1,
        public layer: Array<Sprite> = null) {}
    setImage(image: HTMLImageElement) {
        this.image = image;
        this.width = image.width;
        this.height = image.height;
    }
    onGround() {
        this.vx = 0; this.vy = 0;
        this.grounded = true;
    }
    inAir() {
        this.vy -= this.gravity;
        this.grounded = false;			
    }
    update() {
        if (!this.inPlay)
            return;
        var ground = this.height;
        this.y = Math.max(this.y + this.vy, ground);
        this.x = Math.round(this.x + this.vx);
        // Wraparound!
        if (this.x > mainGame.worldWidth) {
            this.x = 0;
        } else if (this.x < 0) {
            this.x = mainGame.worldWidth;
        }
        // where the player wants to check for collision
        if (this.gravity > 0) {
            if (this.y > ground) {
                this.inAir();
            } else {
                this.onGround();
            }
        }
    } // update
    draw () {
        if (!this.inPlay)
            return;
        // future optimization:  skip drawing if no sprite
        // overlap or change since last update
        var ctx = canvas.getContext('2d')
        if (this.image == null) {
            console.log('Cannot draw null image');
        } else {
            ctx.drawImage(this.image, this.x, mainGame.worldHeight - this.y);
        }
    }
}

class Cloud extends Sprite {
    constructor(which: number, public sinceLastDrop: number = 0) {
        super();
        this.setImage(document.getElementById('cloud' + which) as HTMLImageElement);
        this.solid = false;
        this.gravity = 0;
        this.x = random_int(mainGame.worldWidth);
        this.y = 300 + random_int(100);
        this.vy = 0;
    }
    update() {
        super.update();
        if (this.x <= this.width  ||  this.x > (mainGame.worldWidth - this.width))
            return;
        // Don't drop too often, or too rarely.
        // Within these constraints, it can be random.
        if (++this.sinceLastDrop < 5) {
            return;
        }
        if (this.sinceLastDrop < 40  &&  random_int(10) != 0) {
            return;
        }
        var drop: Sprite = null;
        if (random_int(5) <= 1) {
            drop = new Apple();
        } else {
            drop = new Gumdrop(random_int(5) + 1);
        }
        drop.x = this.x + this.width / 2;
        drop.y = this.y - this.height / 2;
        drop.vx = 0;
        drop.vy = 0;
        mainGame.addSprite(drop, 0);
        this.sinceLastDrop = 0;
    }
}

class Gumdrop extends Sprite {
    constructor(which: number) {
        super();
        this.setImage(document.getElementById('gumdrop' + which) as HTMLImageElement);
        this.hitScore = 1;
    }
    inAir() {
        this.vy = Math.max(this.vy - this.gravity, -3);
        this.grounded = false;
    }
    onGround() {
        this.inPlay = false;
    }
}

class Apple extends Sprite {
    constructor() {
        super();
        this.setImage(document.getElementById('apple') as HTMLImageElement);
        this.hitScore = -10;
    }
    inAir() {
        this.vy = Math.max(this.vy - this.gravity, -5);
    }
    onGround() {
        this.inPlay = false;
    }
}

class Player extends Sprite {
    flashoff_x: number;
    flashoff_y: number;
    constructor(
        public normal = document.getElementById('player') as HTMLImageElement,
        public flash = document.getElementById('flash') as HTMLImageElement,
        public drawFlash = false
    ) {
        super();
        this.setImage(normal);
        // Remember the offset at which the flash will need to be
        // drawn.
        this.flashoff_x = Math.floor(flash.width / 2) - Math.floor(normal.width / 2);
        this.flashoff_y = Math.floor(flash.height / 2) - Math.floor(normal.height / 2);
        this.gravity = 1;
    }
    draw() {
        if (this.drawFlash) {
            var ctx = canvas.getContext('2d');
            ctx.drawImage(
                this.flash, this.x - this.flashoff_x,
                mainGame.worldHeight - (this.y + this.flashoff_y)
                )
        }
        super.draw();
    }
    update() {
        // Check it against all other sprites except me.
        // This is done before positions are updated, so that
        // what the player sees on screen agrees with this calculation.
        if (this.solid) {
            var r1 = new Rectangle(
                this.x, mainGame.worldHeight - this.y,
                this.width, this.height);
            mainGame.allSprites.forEach((check: Sprite) => {
                if (this != check && check.solid) {
                    // See if the rectangles intersect
                    var r2 = new Rectangle(
                        check.x, mainGame.worldHeight - check.y,
                        check.width, check.height);
                    if (rectanglesIntersect(r1, r2)) {
                        this.collidedWith(check);
                    }
                }
            });
        }
        super.update();
    }
    collidedWith(s: Sprite) {
        if (s.hitScore != 0) {
            s.inPlay = false;
            var score = s.hitScore;
            if (!this.grounded) {
                // Double points!
                score *= 2;
            }
            var next_score = Math.max(mainGame.totalScore + score, 0);
            if (score > 0  &&
                  mainGame.totalScore < mainGame.flashMilestone  &&
                  next_score >= mainGame.flashMilestone) {
                this.drawFlash = true;
                setTimeout(() => { this.drawFlash = false; }, 750);
                mainGame.flashMilestone += mainGame.flashScore;
            }
            mainGame.updateScore(next_score);
        }
    }
    // Respond to player controls.
    left()  { if (this.grounded) this.vx = -5; }
    right() { if (this.grounded) this.vx =  5; }
    jump()  { if (this.grounded) this.vy =  10; }

}

var mainGame: MainGame = null;
var canvas: HTMLCanvasElement = null;

function initialize() {
    mainGame = new MainGame();
    // Arrange event routing
    canvas = document.getElementById('game') as HTMLCanvasElement;
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    game_start();
}

function handleKeyDown(event: { keyCode: any; }) {
    var code = event.keyCode;
    switch (code) {
        case 37: mainGame.pressingLeft = true; break;
        case 39: mainGame.pressingRight = true; break;
        case 32: mainGame.jump(); break;
        case 78: game_start(); break;
    }
}
function handleKeyUp(event: { keyCode: any; }) {
    var code = event.keyCode;
    switch (code) {
        case 37: mainGame.pressingLeft = false; break;
        case 39: mainGame.pressingRight = false; break;
    }
}

function handleMouseDown(event: any) {
    var x = event.offsetX;
    var y = event.offsetY;
    if (x < mainGame.player.x) {
        mainGame.pressingLeft = true;
        mainGame.pressingRight = false;
    } else {
        mainGame.pressingLeft = false;
        mainGame.pressingRight = true;
    }
}

function handleMouseUp(event: any) {
    mainGame.pressingLeft = false;
    mainGame.pressingRight = false;
}

// It's crucially important to have the event responses as free
// functions here.  Otherwise, they sort of work, but there are
// some extremely strange variable resolutions that cause bugs,
// like data members not being found or updated.
function game_start() {
    mainGame.stop();
    mainGame.start();
    mainGame.timerId = setInterval(game_cycle, 50);
}

function game_cycle() {
    mainGame.cycle();
}