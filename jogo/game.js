// ============================
// ZÉ CASTANHA — GAMBIARRA GAME
// Fase 2: Polish do core (near miss, combo, fragmentação,
// power-ups, feedback visual e áudio) — ainda 100% local, sem Supabase
// ============================

// ---------------------------------------------------------------
// ASSET_CONFIG — troque as chaves abaixo quando os PNGs finais
// estiverem em ../assets/jogo/. Nada na lógica de gameplay precisa
// mudar: basta apontar USE_PLACEHOLDER_ART = false e ajustar os paths.
// ---------------------------------------------------------------
const USE_PLACEHOLDER_ART = false;
const ASSET_PATHS = {
    ship: '../assets/jogo/nave.png',
    asteroidSmall: '../assets/jogo/asteroide-pequeno.png',
    asteroidMedium: '../assets/jogo/asteroide-medio.png',
    asteroidLarge: '../assets/jogo/asteroide-grande.png',
    asteroidFragment: '../assets/jogo/asteroide-fragmento.png',
    projectile: '../assets/jogo/projetil.png',
    explosion: '../assets/jogo/explosao.png',
    powerupShield: '../assets/jogo/powerup-caneca.png',
    powerupHyperspace: '../assets/jogo/powerup-hiperespaco.png',
    powerupFlyingHorse: '../assets/jogo/powerup-flyinghorse.png',
};

// A arte da nave aponta para a esquerda (<<) e a do projétil para a
// direita (>>) por padrão. Corrigimos com ângulo fixo para o bico/traço
// apontar pra cima (sentido do voo). Ajuste aqui se trocar a arte.
const SHIP_ART_ANGLE_OFFSET = 90; // << -> para cima
const PROJECTILE_ART_ANGLE_OFFSET = -90; // >> -> para cima

// Os PNGs vêm em alta resolução (ex: 1254x1254). Aqui definimos o
// tamanho de EXIBIÇÃO no jogo (em px lógicos, tela de 480x854).
// A física (colisão) acompanha automaticamente esse tamanho.
const SPRITE_SIZE = {
    ship: { w: 90, h: 60 }, // nave.png é 1536x1024 (proporção 1.5:1)
    asteroidSmall: 60,
    asteroidMedium: 82,
    asteroidLarge: 130,
    asteroidFragment: 42,
    projectile: 40,
    powerupSquare: 40, // caneca e hiperespaço (arte quadrada)
    powerupFlyingHorse: { w: 30, h: 60 }, // lata vertical (887x1774)
};

// Config de gameplay (equivalente local ao futuro game_config do Supabase)
const CONFIG = {
    logicalWidth: 480,
    logicalHeight: 854,
    shipSpeed: 900, // px/s ao seguir o dedo/mouse
    shipHitboxScale: 0.7, // hitbox menor que o sprite = sensação justa
    fireIntervalMs: 260,
    projectileSpeed: 640,
    scorePerSecond: 10,
    scoreSmall: 20,
    scoreMedium: 50,
    scoreLarge: 150,
    largeAsteroidHp: 8, // ~8 tiros pra destruir (fireIntervalMs=260ms -> ~2s de fogo constante)

    difficulty: [
        { untilMs: 10000, spawnMs: 900, speed: 220, medium: 0, large: 0, fragment: 0 },
        { untilMs: 25000, spawnMs: 700, speed: 260, medium: 0.25, large: 0, fragment: 0 },
        { untilMs: 45000, spawnMs: 550, speed: 300, medium: 0.35, large: 0.15, fragment: 0.2 },
        { untilMs: 75000, spawnMs: 420, speed: 340, medium: 0.4, large: 0.2, fragment: 0.3 },
        { untilMs: Infinity, spawnMs: 340, speed: 380, medium: 0.45, large: 0.25, fragment: 0.35 },
    ],

    nearMiss: {
        thresholdPx: 30, // faixa extra além da hitbox que conta como "quase"
        scoreValue: 35,
    },

    combo: {
        windowMs: 1600, // tempo sem eventos até o combo zerar
        eventsPerLevel: 3, // a cada N eventos, sobe 1 nível de multiplicador
        maxMultiplier: 3,
    },

    powerups: {
        spawnEveryMs: 11000,
        fallSpeed: 200,
        shield: { weight: 1 },
        hyperspace: { weight: 1, durationMs: 4000, scoreBonus: 300, speedMultiplier: 1.6 },
        flyinghorse: { weight: 1, durationMs: 4000, speedMultiplier: 1.3, ramScore: 15 },
    },
};

const STORAGE_KEY = 'zecastanha_jogo_best_score';

let scene;
let ship;
let asteroids;
let projectiles;
let powerups;
let cursors;
let keyA, keyD;
let pointerTargetX = null;

let lastFireAt = 0;
let lastSpawnAt = 0;
let lastPowerupAt = 0;
let runStartedAt = 0;
let score = 0;
let alive = false;
let muted = false;

let comboCount = 0;
let lastComboEventAt = 0;
let shielded = false;
let shieldIcon = null;
let flyingHorseIcon = null;
let hyperspaceIcon = null;
let hyperspaceUntil = 0;
let hyperspaceTrailTimer = 0;
let flyingHorseUntil = 0;
let flyingHorseTrailTimer = 0;

function getDifficultyStage(elapsedMs) {
    return CONFIG.difficulty.find(stage => elapsedMs < stage.untilMs) || CONFIG.difficulty[CONFIG.difficulty.length - 1];
}

function getBestScore() {
    return Number(localStorage.getItem(STORAGE_KEY) || 0);
}

function setBestScore(value) {
    localStorage.setItem(STORAGE_KEY, String(value));
}

function getComboMultiplier() {
    const level = Math.floor(comboCount / CONFIG.combo.eventsPerLevel);
    return Phaser.Math.Clamp(1 + level, 1, CONFIG.combo.maxMultiplier);
}

function registerComboEvent(now) {
    comboCount += 1;
    lastComboEventAt = now;
}

// ---------------------------------------------------------------
// Áudio sintetizado (sem arquivos) — respeita mute e autoplay policy
// ---------------------------------------------------------------
const Audio = {
    ctx: null,
    ensure() {
        if (!this.ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (AC) this.ctx = new AC();
        }
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
        return this.ctx;
    },
    beep(freq, durationMs, type = 'sine', volume = 0.15) {
        if (muted) return;
        const ctx = this.ensure();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.value = volume;
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + durationMs / 1000);
    },
    shoot() { this.beep(760, 45, 'square', 0.03); },
    hit() { this.beep(220, 90, 'square', 0.08); },
    explosion() { this.beep(90, 260, 'sawtooth', 0.14); },
    nearMiss() { this.beep(980, 90, 'triangle', 0.08); },
    powerup() { this.beep(660, 140, 'triangle', 0.1); this.beep(880, 140, 'triangle', 0.08); },
    gameOver() { this.beep(180, 380, 'sawtooth', 0.12); },
    newRecord() { this.beep(523, 110, 'triangle', 0.1); setTimeout(() => this.beep(659, 110, 'triangle', 0.1), 110); setTimeout(() => this.beep(880, 200, 'triangle', 0.1), 220); },
};

// ---------------------------------------------------------------
// Phaser Scene
// ---------------------------------------------------------------
class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    preload() {
        if (!USE_PLACEHOLDER_ART) {
            this.load.image('ship', ASSET_PATHS.ship);
            this.load.image('asteroid-small', ASSET_PATHS.asteroidSmall);
            this.load.image('asteroid-medium', ASSET_PATHS.asteroidMedium);
            this.load.image('asteroid-large', ASSET_PATHS.asteroidLarge);
            this.load.image('asteroid-fragment', ASSET_PATHS.asteroidFragment);
            this.load.image('projectile', ASSET_PATHS.projectile);
            this.load.image('explosion', ASSET_PATHS.explosion);
            this.load.image('powerup-shield', ASSET_PATHS.powerupShield);
            this.load.image('powerup-hyperspace', ASSET_PATHS.powerupHyperspace);
            this.load.image('powerup-flyinghorse', ASSET_PATHS.powerupFlyingHorse);
        }
    }

    create() {
        if (USE_PLACEHOLDER_ART) {
            this.generatePlaceholderTextures();
        }
        this.generateUtilityTextures();

        this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');

        ship = this.physics.add.image(CONFIG.logicalWidth / 2, CONFIG.logicalHeight - 90, 'ship');
        ship.setDisplaySize(SPRITE_SIZE.ship.w, SPRITE_SIZE.ship.h);
        if (!USE_PLACEHOLDER_ART) ship.setAngle(SHIP_ART_ANGLE_OFFSET);
        ship.setCollideWorldBounds(true);
        ship.body.setAllowGravity(false);
        // Hitbox: raio calculado no espaço NATIVO da textura (dividido pela escala
        // atual), pois a física Arcade escala o corpo automaticamente pelo scale
        // do sprite. Isso garante o mesmo raio visual final independente da
        // resolução do PNG carregado.
        {
            const displayRadius = (Math.min(SPRITE_SIZE.ship.w, SPRITE_SIZE.ship.h) / 2) * CONFIG.shipHitboxScale;
            const nativeRadius = displayRadius / ship.scaleX;
            const offsetX = ship.width / 2 - nativeRadius;
            const offsetY = ship.height / 2 - nativeRadius;
            ship.setCircle(nativeRadius, offsetX, offsetY);
        }
        ship.setVisible(false);
        ship.setActive(false);
        ship.setDepth(5);

        asteroids = this.physics.add.group();
        projectiles = this.physics.add.group();
        powerups = this.physics.add.group();

        this.physics.add.overlap(projectiles, asteroids, onProjectileHitAsteroid, null, this);
        this.physics.add.overlap(ship, asteroids, onShipHitAsteroid, null, this);
        this.physics.add.overlap(ship, powerups, onShipHitPowerup, null, this);

        cursors = this.input.keyboard.createCursorKeys();
        keyA = this.input.keyboard.addKey('A');
        keyD = this.input.keyboard.addKey('D');

        this.input.on('pointerdown', p => { pointerTargetX = p.x; });
        this.input.on('pointermove', p => { if (p.isDown) pointerTargetX = p.x; });
        this.input.on('pointerup', () => { pointerTargetX = null; });

        scene = this;
    }

    generatePlaceholderTextures() {
        const g = this.add.graphics();

        // Nave: triângulo dourado
        g.clear();
        g.fillStyle(0xffc107, 1);
        g.fillTriangle(20, 0, 0, 44, 40, 44);
        g.lineStyle(2, 0xfff3c4, 1);
        g.strokeTriangle(20, 0, 0, 44, 40, 44);
        g.generateTexture('ship', 40, 44);

        // Asteroide pequeno
        g.clear();
        g.fillStyle(0x8a8a94, 1);
        g.fillCircle(14, 14, 14);
        g.lineStyle(2, 0xcfcfd6, 1);
        g.strokeCircle(14, 14, 14);
        g.generateTexture('asteroid-small', 28, 28);

        // Asteroide médio
        g.clear();
        g.fillStyle(0x6f6f7a, 1);
        g.fillCircle(24, 24, 24);
        g.lineStyle(2, 0xb8b8c2, 1);
        g.strokeCircle(24, 24, 24);
        g.generateTexture('asteroid-medium', 48, 48);

        // Asteroide grande (quase indestrutível)
        g.clear();
        g.fillStyle(0x4b4b55, 1);
        g.fillCircle(38, 38, 38);
        g.lineStyle(3, 0xff4444, 0.6);
        g.strokeCircle(38, 38, 38);
        g.generateTexture('asteroid-large', 76, 76);

        // Projétil
        g.clear();
        g.fillStyle(0x4bd5ee, 1);
        g.fillRoundedRect(0, 0, 6, 18, 3);
        g.generateTexture('projectile', 6, 18);

        // Power-up: Caneca Original (escudo) — caneca dourada simples
        g.clear();
        g.fillStyle(0xffc107, 1);
        g.fillRoundedRect(4, 6, 20, 22, 4);
        g.fillStyle(0x030305, 1);
        g.fillRoundedRect(8, 10, 12, 14, 2);
        g.lineStyle(3, 0xffc107, 1);
        g.strokeRoundedRect(24, 12, 8, 10, 3);
        g.generateTexture('powerup-shield', 34, 34);

        // Power-up: Hiperespaço — estrela/raio cyan
        g.clear();
        g.fillStyle(0x4bd5ee, 1);
        g.fillTriangle(17, 0, 6, 20, 17, 14);
        g.fillTriangle(17, 14, 28, 20, 17, 34);
        g.generateTexture('powerup-hyperspace', 34, 34);

        // Power-up: Flying Horse — latinha de energético estilizada + raio
        g.clear();
        g.fillStyle(0x1a1a22, 1);
        g.fillRoundedRect(9, 3, 16, 28, 3);
        g.fillStyle(0xff4444, 1);
        g.fillRect(9, 12, 16, 8);
        g.fillStyle(0xffc107, 1);
        g.fillTriangle(19, 6, 13, 18, 18, 18);
        g.fillTriangle(18, 18, 24, 18, 15, 30);
        g.generateTexture('powerup-flyinghorse', 34, 34);

        g.destroy();
    }

    // Texturas de UI/efeito geradas por código (anéis de status ao redor da
    // nave). Independem do PNG final da nave/asteroides, então SEMPRE são
    // geradas, mesmo com USE_PLACEHOLDER_ART = false.
    generateUtilityTextures() {
        const g = this.add.graphics();

        // Anel de escudo (Caneca)
        g.clear();
        g.lineStyle(4, 0xffc107, 0.95);
        g.strokeCircle(40, 40, 34);
        g.generateTexture('shield-ring', 80, 80);

        // Anel do Flying Horse (invencibilidade)
        g.clear();
        g.lineStyle(4, 0xff4444, 0.95);
        g.strokeCircle(40, 40, 34);
        g.lineStyle(2, 0xffc107, 0.8);
        g.strokeCircle(40, 40, 27);
        g.generateTexture('flyinghorse-ring', 80, 80);

        // Anel do Hiperespaço
        g.clear();
        g.lineStyle(4, 0x4bd5ee, 0.95);
        g.strokeCircle(40, 40, 34);
        g.generateTexture('hyperspace-ring', 80, 80);

        // Flash circular usado nas animações de ativação de power-up
        g.clear();
        g.fillStyle(0xffffff, 1);
        g.fillCircle(40, 40, 40);
        g.generateTexture('flash-burst', 80, 80);

        g.destroy();
    }

    update(time, delta) {
        if (!alive) return;

        const isHyperspace = time < hyperspaceUntil;
        const isFlyingHorse = time < flyingHorseUntil;

        // --- Movimento da nave ---
        let targetX = pointerTargetX;
        if (targetX === null) {
            if (cursors.left.isDown || keyA.isDown) targetX = ship.x - 200;
            else if (cursors.right.isDown || keyD.isDown) targetX = ship.x + 200;
        }
        let speedMultiplier = 1;
        if (isHyperspace) speedMultiplier = CONFIG.powerups.hyperspace.speedMultiplier;
        else if (isFlyingHorse) speedMultiplier = CONFIG.powerups.flyinghorse.speedMultiplier;
        const currentShipSpeed = CONFIG.shipSpeed * speedMultiplier;
        if (targetX !== null) {
            const dx = Phaser.Math.Clamp(targetX, 24, CONFIG.logicalWidth - 24) - ship.x;
            const move = Phaser.Math.Clamp(dx, -currentShipSpeed * (delta / 1000), currentShipSpeed * (delta / 1000));
            ship.x += move;
        }

        if (shieldIcon) shieldIcon.setPosition(ship.x, ship.y);
        if (flyingHorseIcon) flyingHorseIcon.setPosition(ship.x, ship.y);
        if (hyperspaceIcon) hyperspaceIcon.setPosition(ship.x, ship.y);

        // --- Trail do hiperespaço ---
        if (isHyperspace && time - hyperspaceTrailTimer > 30) {
            hyperspaceTrailTimer = time;
            spawnTrailParticle(ship.x, ship.y + 20, 0x4bd5ee);
        }

        // --- Trail do Flying Horse ---
        if (isFlyingHorse && time - flyingHorseTrailTimer > 30) {
            flyingHorseTrailTimer = time;
            spawnTrailParticle(ship.x, ship.y + 20, 0xff4444);
        }

        // --- Fim do Flying Horse: some o anel ---
        if (!isFlyingHorse && flyingHorseIcon) {
            flyingHorseIcon.destroy();
            flyingHorseIcon = null;
        }

        // --- Fim do Hiperespaço: some o anel ---
        if (!isHyperspace && hyperspaceIcon) {
            hyperspaceIcon.destroy();
            hyperspaceIcon = null;
        }

        // --- Tiro automático ---
        if (time - lastFireAt > CONFIG.fireIntervalMs) {
            lastFireAt = time;
            const p = projectiles.create(ship.x, ship.y - 24, 'projectile');
            p.setDisplaySize(SPRITE_SIZE.projectile, SPRITE_SIZE.projectile);
            if (!USE_PLACEHOLDER_ART) p.setAngle(PROJECTILE_ART_ANGLE_OFFSET);
            p.body.setAllowGravity(false);
            p.setVelocityY(-CONFIG.projectileSpeed);
            Audio.shoot();
        }

        // --- Spawner de asteroides (dificuldade progressiva) ---
        const elapsed = time - runStartedAt;
        const stage = getDifficultyStage(elapsed);
        if (time - lastSpawnAt > stage.spawnMs) {
            lastSpawnAt = time;
            spawnAsteroid(stage);
        }

        // --- Spawner de power-ups ---
        if (time - lastPowerupAt > CONFIG.powerups.spawnEveryMs) {
            lastPowerupAt = time;
            spawnPowerup();
        }

        // --- Combo: perde força se ficar muito tempo sem evento ---
        if (comboCount > 0 && time - lastComboEventAt > CONFIG.combo.windowMs) {
            comboCount = 0;
        }

        // --- Near miss ---
        asteroids.children.each(a => {
            if (!a.active || a.getData('nearMissChecked')) return;
            if (a.y >= ship.y - 6) {
                a.setData('nearMissChecked', true);
                const dx = Math.abs(a.x - ship.x);
                const minSafe = (a.displayWidth / 2) + (ship.displayWidth * CONFIG.shipHitboxScale / 2);
                if (dx > minSafe && dx < minSafe + CONFIG.nearMiss.thresholdPx) {
                    awardNearMiss(a.x, a.y);
                }
            }
        });

        // --- Score por sobrevivência ---
        score += CONFIG.scorePerSecond * (delta / 1000);
        updateHud();

        // --- Limpeza de objetos fora da tela ---
        projectiles.children.each(p => { if (p.active && p.y < -20) p.destroy(); });
        asteroids.children.each(a => { if (a.active && a.y > CONFIG.logicalHeight + 60) a.destroy(); });
        powerups.children.each(p => { if (p.active && p.y > CONFIG.logicalHeight + 60) p.destroy(); });
    }
}

function spawnAsteroid(stage) {
    const roll = Math.random();
    let key = 'asteroid-small';
    let hp = 1;
    let scoreValue = CONFIG.scoreSmall;
    let fragmentable = false;

    if (roll < stage.large) {
        key = 'asteroid-large';
        hp = CONFIG.largeAsteroidHp;
        scoreValue = CONFIG.scoreLarge;
    } else if (roll < stage.large + stage.medium) {
        key = 'asteroid-medium';
        hp = 2;
        scoreValue = CONFIG.scoreMedium;
        fragmentable = Math.random() < stage.fragment;
    }

    const x = Phaser.Math.Between(30, CONFIG.logicalWidth - 30);
    const a = asteroids.create(x, -40, key);
    const size = key === 'asteroid-small' ? SPRITE_SIZE.asteroidSmall
        : key === 'asteroid-medium' ? SPRITE_SIZE.asteroidMedium
        : SPRITE_SIZE.asteroidLarge;
    a.setDisplaySize(size, size);
    a.body.setAllowGravity(false);
    a.setVelocityY(stage.speed);
    a.setAngularVelocity(Phaser.Math.Between(-60, 60));
    a.setData('hp', hp);
    a.setData('scoreValue', scoreValue);
    a.setData('fragmentable', fragmentable);
    a.setData('nearMissChecked', false);
    if (fragmentable) a.setTint(0xffe08a);
}

function spawnFragments(x, y, stageSpeed) {
    const fragmentKey = USE_PLACEHOLDER_ART ? 'asteroid-small' : 'asteroid-fragment';
    for (let i = 0; i < 2; i++) {
        const f = asteroids.create(x, y, fragmentKey);
        f.setDisplaySize(SPRITE_SIZE.asteroidFragment, SPRITE_SIZE.asteroidFragment);
        f.body.setAllowGravity(false);
        f.setVelocity(i === 0 ? -90 : 90, stageSpeed * 0.9);
        f.setAngularVelocity(Phaser.Math.Between(-120, 120));
        f.setData('hp', 1);
        f.setData('scoreValue', Math.round(CONFIG.scoreSmall / 2));
        f.setData('fragmentable', false);
        f.setData('nearMissChecked', true); // fragmento não conta near miss
    }
}

function spawnPowerup() {
    const types = ['shield', 'hyperspace', 'flyinghorse'];
    const type = types[Phaser.Math.Between(0, types.length - 1)];
    const x = Phaser.Math.Between(40, CONFIG.logicalWidth - 40);
    const keys = { shield: 'powerup-shield', hyperspace: 'powerup-hyperspace', flyinghorse: 'powerup-flyinghorse' };
    const p = powerups.create(x, -30, keys[type]);
    if (type === 'flyinghorse') {
        p.setDisplaySize(SPRITE_SIZE.powerupFlyingHorse.w, SPRITE_SIZE.powerupFlyingHorse.h);
    } else {
        p.setDisplaySize(SPRITE_SIZE.powerupSquare, SPRITE_SIZE.powerupSquare);
    }
    p.body.setAllowGravity(false);
    p.setVelocityY(CONFIG.powerups.fallSpeed);
    p.setAngularVelocity(40);
    p.setData('type', type);
}

function onProjectileHitAsteroid(projectile, asteroid) {
    projectile.destroy();
    const hp = asteroid.getData('hp') - 1;
    if (hp <= 0) {
        const multiplier = getComboMultiplier();
        const gain = asteroid.getData('scoreValue') * multiplier;
        score += gain;
        registerComboEvent(scene.time.now);
        spawnHitParticles(asteroid.x, asteroid.y, 0xffc107);
        if (gain > 0) showFloatingText(asteroid.x, asteroid.y, `+${gain}`, '#ffc107', 15);
        Audio.hit();

        if (asteroid.getData('fragmentable')) {
            const stage = getDifficultyStage(scene.time.now - runStartedAt);
            spawnFragments(asteroid.x, asteroid.y, stage.speed);
        }

        asteroid.destroy();
    } else {
        asteroid.setData('hp', hp);
        scene.tweens.add({ targets: asteroid, alpha: 0.4, duration: 60, yoyo: true });
    }
}

function awardNearMiss(x, y) {
    const multiplier = getComboMultiplier();
    score += CONFIG.nearMiss.scoreValue * multiplier;
    registerComboEvent(scene.time.now);
    Audio.nearMiss();
    showFloatingText(x, y - 10, `QUASE! +${CONFIG.nearMiss.scoreValue * multiplier}`, '#4bd5ee');
    if (getComboMultiplier() > 1) {
        showFloatingText(ship.x, ship.y - 50, `COMBO x${getComboMultiplier()}`, '#ffc107', 20);
    }
}

function onShipHitPowerup(shipObj, powerup) {
    const type = powerup.getData('type');
    powerup.destroy();
    Audio.powerup();

    if (type === 'shield') {
        activateShield();
        showFloatingText(ship.x, ship.y - 40, 'ESCUDO ATIVO', '#ffc107', 16);
    } else if (type === 'hyperspace') {
        activateHyperspace();
        showFloatingText(ship.x, ship.y - 40, `HIPERESPAÇO +${CONFIG.powerups.hyperspace.scoreBonus}`, '#4bd5ee', 16);
        score += CONFIG.powerups.hyperspace.scoreBonus;
    } else if (type === 'flyinghorse') {
        activateFlyingHorse();
        showFloatingText(ship.x, ship.y - 40, 'TÔ VOANDO! 🐎', '#ff4444', 16);
    }
}

function activateShield() {
    shielded = true;
    if (shieldIcon) shieldIcon.destroy();
    shieldIcon = scene.add.image(ship.x, ship.y, 'shield-ring');
    shieldIcon.setDepth(4);
    scene.tweens.add({ targets: shieldIcon, angle: 360, duration: 2000, repeat: -1 });
}

function deactivateShield() {
    shielded = false;
    if (shieldIcon) {
        shieldIcon.destroy();
        shieldIcon = null;
    }
}

function activateHyperspace() {
    hyperspaceUntil = scene.time.now + CONFIG.powerups.hyperspace.durationMs;
    if (hyperspaceIcon) hyperspaceIcon.destroy();
    hyperspaceIcon = scene.add.image(ship.x, ship.y, 'hyperspace-ring');
    hyperspaceIcon.setDepth(4);
    scene.tweens.add({ targets: hyperspaceIcon, angle: 360, duration: 500, repeat: -1 });
    spawnActivationFlash(0x4bd5ee);
    scene.cameras.main.flash(180, 75, 213, 238);
}

function activateFlyingHorse() {
    flyingHorseUntil = scene.time.now + CONFIG.powerups.flyinghorse.durationMs;
    if (flyingHorseIcon) flyingHorseIcon.destroy();
    flyingHorseIcon = scene.add.image(ship.x, ship.y, 'flyinghorse-ring');
    flyingHorseIcon.setDepth(4);
    scene.tweens.add({ targets: flyingHorseIcon, angle: -360, duration: 900, repeat: -1 });
    spawnActivationFlash(0xff4444);
    scene.cameras.main.flash(180, 255, 68, 68);
}

function spawnActivationFlash(color) {
    const burst = scene.add.image(ship.x, ship.y, 'flash-burst').setDepth(7).setTint(color).setAlpha(0.9);
    burst.setDisplaySize(30, 30);
    scene.tweens.add({
        targets: burst,
        displayWidth: 220,
        displayHeight: 220,
        alpha: 0,
        duration: 380,
        ease: 'Cubic.Out',
        onComplete: () => burst.destroy(),
    });
}

function spawnTrailParticle(x, y, color = 0x4bd5ee) {
    const g = scene.add.graphics();
    g.fillStyle(color, 0.5);
    g.fillCircle(x + Phaser.Math.Between(-6, 6), y, 3);
    scene.tweens.add({ targets: g, alpha: 0, y: y + 20, duration: 300, onComplete: () => g.destroy() });
}

function spawnExplosionSprite(x, y) {
    if (USE_PLACEHOLDER_ART) return; // sem PNG de explosão no modo placeholder
    const img = scene.add.image(x, y, 'explosion').setDepth(6).setAlpha(1);
    img.setDisplaySize(28, 28);
    scene.tweens.add({
        targets: img,
        displayWidth: 120,
        displayHeight: 120,
        alpha: 0,
        duration: 320,
        ease: 'Cubic.Out',
        onComplete: () => img.destroy(),
    });
}

function spawnHitParticles(x, y, color = 0xffc107) {
    for (let i = 0; i < 6; i++) {
        const g = scene.add.graphics();
        g.fillStyle(color, 0.9);
        g.fillCircle(x, y, 3);
        const angle = (Math.PI * 2 * i) / 6;
        scene.tweens.add({
            targets: g,
            x: x + Math.cos(angle) * 22,
            y: y + Math.sin(angle) * 22,
            alpha: 0,
            duration: 220,
            onComplete: () => g.destroy(),
        });
    }
}

function showFloatingText(x, y, text, color = '#fff', size = 14) {
    const t = scene.add.text(x, y, text, {
        fontFamily: 'Space Mono, monospace',
        fontSize: `${size}px`,
        fontStyle: 'bold',
        color,
    }).setOrigin(0.5).setDepth(10);
    scene.tweens.add({
        targets: t,
        y: y - 30,
        alpha: 0,
        duration: 650,
        onComplete: () => t.destroy(),
    });
}

function onShipHitAsteroid(shipObj, asteroid) {
    if (!alive) return;

    if (scene.time.now < flyingHorseUntil) {
        const multiplier = getComboMultiplier();
        const gain = (asteroid.getData('scoreValue') || 0) * multiplier || CONFIG.powerups.flyinghorse.ramScore;
        score += gain;
        registerComboEvent(scene.time.now);
        spawnHitParticles(asteroid.x, asteroid.y, 0xff4444);
        showFloatingText(asteroid.x, asteroid.y, `+${gain}`, '#ff4444', 15);
        Audio.hit();
        if (asteroid.getData('fragmentable')) {
            const stage = getDifficultyStage(scene.time.now - runStartedAt);
            spawnFragments(asteroid.x, asteroid.y, stage.speed);
        }
        asteroid.destroy();
        return;
    }

    if (shielded) {
        deactivateShield();
        spawnHitParticles(asteroid.x, asteroid.y, 0xffc107);
        Audio.hit();
        asteroid.destroy();
        return;
    }

    killShip();
}

function killShip() {
    alive = false;
    ship.setActive(false).setVisible(false);
    deactivateShield();
    if (flyingHorseIcon) { flyingHorseIcon.destroy(); flyingHorseIcon = null; }
    if (hyperspaceIcon) { hyperspaceIcon.destroy(); hyperspaceIcon = null; }
    flyingHorseUntil = 0;
    hyperspaceUntil = 0;

    scene.cameras.main.shake(180, 0.01);
    spawnHitParticles(ship.x, ship.y, 0xff4444);
    spawnExplosionSprite(ship.x, ship.y);
    Audio.explosion();

    asteroids.children.each(a => a.setVelocity(0, 0));
    projectiles.children.each(p => p.destroy());
    powerups.children.each(p => p.destroy());

    setTimeout(() => showGameOver(), 220);
}

// ---------------------------------------------------------------
// Ligação com a UI (HTML)
// ---------------------------------------------------------------
function updateHud() {
    const hudScore = document.getElementById('hudScore');
    if (hudScore) hudScore.textContent = Math.floor(score).toLocaleString('pt-BR');

    const hudCombo = document.getElementById('hudCombo');
    if (hudCombo) {
        const mult = getComboMultiplier();
        if (mult > 1) {
            hudCombo.textContent = `COMBO x${mult}`;
            hudCombo.classList.remove('hidden');
        } else {
            hudCombo.classList.add('hidden');
        }
    }
}

function showGameOver() {
    const finalScore = Math.floor(score);
    const best = getBestScore();
    const isNewBest = finalScore > best;
    if (isNewBest) {
        setBestScore(finalScore);
        Audio.newRecord();
    } else {
        Audio.gameOver();
    }

    document.getElementById('hud').classList.add('hidden');
    document.getElementById('finalScore').textContent = finalScore.toLocaleString('pt-BR');
    document.getElementById('bestScoreNote').classList.toggle('hidden', !isNewBest);
    document.getElementById('screen-gameover').classList.remove('hidden');

    if (typeof gtag === 'function') {
        gtag('event', 'game_over', { score: finalScore, is_personal_best: isNewBest });
    }
    if (typeof fbq === 'function') {
        fbq('trackCustom', 'GameComplete', { score: finalScore });
    }
}

function startRun() {
    Audio.ensure();

    document.getElementById('screen-start').classList.add('hidden');
    document.getElementById('screen-gameover').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');

    asteroids.clear(true, true);
    projectiles.clear(true, true);
    powerups.clear(true, true);
    deactivateShield();
    if (flyingHorseIcon) { flyingHorseIcon.destroy(); flyingHorseIcon = null; }
    if (hyperspaceIcon) { hyperspaceIcon.destroy(); hyperspaceIcon = null; }

    score = 0;
    comboCount = 0;
    lastComboEventAt = 0;
    hyperspaceUntil = 0;
    flyingHorseUntil = 0;
    updateHud();
    ship.setPosition(CONFIG.logicalWidth / 2, CONFIG.logicalHeight - 90);
    ship.setActive(true).setVisible(true);

    runStartedAt = scene.time.now;
    lastFireAt = scene.time.now;
    lastSpawnAt = scene.time.now;
    lastPowerupAt = scene.time.now;
    alive = true;

    if (typeof gtag === 'function') gtag('event', 'game_start');
    if (typeof fbq === 'function') fbq('trackCustom', 'GameStart');
}

function initGame() {
    const config = {
        type: Phaser.AUTO,
        parent: 'jogo-canvas-root',
        transparent: true,
        width: CONFIG.logicalWidth,
        height: CONFIG.logicalHeight,
        scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        physics: {
            default: 'arcade',
            arcade: { gravity: { y: 0 }, debug: false },
        },
        scene: GameScene,
    };

    new Phaser.Game(config);

    document.getElementById('btnPlay').addEventListener('click', startRun);
    document.getElementById('btnReplay').addEventListener('click', startRun);

    const muteBtn = document.getElementById('muteBtn');
    if (muteBtn) {
        muteBtn.addEventListener('click', () => {
            muted = !muted;
            muteBtn.textContent = muted ? '🔇' : '🔊';
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
} else {
    initGame();
}
