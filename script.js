// ============================
// ZÉ CASTANHA NAS ESTRELAS
// Script v2 — Seções Imersivas
// ============================

const canvas = document.getElementById('spaceCanvas');
const ctx = canvas.getContext('2d');

let width, height;
let stars = [];
const numStars = 600;
let speed = 0.3;
let center = { x: 0, y: 0 };
let targetX = 0;
let targetY = 0;

function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    center.x = width / 2;
    center.y = height / 2;
    targetX = center.x;
    targetY = center.y;
}

window.addEventListener('resize', resize);
resize();

// --- PARALLAX ---
document.addEventListener('mousemove', (e) => {
    const offsetX = (e.clientX - width / 2) * 0.06;
    const offsetY = (e.clientY - height / 2) * 0.06;
    targetX = (width / 2) + offsetX;
    targetY = (height / 2) + offsetY;
});

class Star {
    constructor() {
        this.reset();
    }

    reset() {
        this.x = (Math.random() - 0.5) * width * 2;
        this.y = (Math.random() - 0.5) * height * 2;
        this.z = Math.random() * width;
        this.pz = this.z;
    }

    update() {
        this.z -= speed;
        if (this.z < 1) {
            this.reset();
            this.z = width;
            this.pz = this.z;
        }
    }

    draw() {
        const sx = (this.x / this.z) * width + center.x;
        const sy = (this.y / this.z) * height + center.y;
        this.pz = this.z;

        const size = (1 - this.z / width) * 2;
        const opacity = (1 - this.z / width);

        ctx.beginPath();
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.8})`;
        ctx.arc(sx, sy, size, 0, Math.PI * 2);
        ctx.fill();
    }
}

function initStars() {
    for (let i = 0; i < numStars; i++) {
        stars.push(new Star());
    }
}

function animate() {
    center.x += (targetX - center.x) * 0.03;
    center.y += (targetY - center.y) * 0.03;

    ctx.fillStyle = 'rgba(3, 3, 5, 0.35)';
    ctx.fillRect(0, 0, width, height);

    stars.forEach(star => {
        star.update();
        star.draw();
    });

    requestAnimationFrame(animate);
}

initStars();
animate();

// --- HAMBURGER MENU ---
const hamburgerBtn = document.getElementById('hamburgerBtn');
const mobileMenu = document.getElementById('mobileMenu');

if (hamburgerBtn && mobileMenu) {
    hamburgerBtn.addEventListener('click', () => {
        hamburgerBtn.classList.toggle('open');
        mobileMenu.classList.toggle('open');
        // Trava/destrava scroll do body
        document.body.style.overflow = mobileMenu.classList.contains('open') ? 'hidden' : '';
    });
}

function closeMobileMenu() {
    if (hamburgerBtn && mobileMenu) {
        hamburgerBtn.classList.remove('open');
        mobileMenu.classList.remove('open');
        document.body.style.overflow = '';
    }
}

// --- SMOOTH SCROLL SEM '#' NA URL ---
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        const targetId = this.getAttribute('href').substring(1);
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
            e.preventDefault();
            targetEl.scrollIntoView({ behavior: 'smooth' });
            if (history.replaceState) {
                history.replaceState(null, null, window.location.pathname);
            }
            closeMobileMenu();
        }
    });
});

// Se carregar com hash, rola suave e remove o hash da barra de endereços
window.addEventListener('DOMContentLoaded', () => {
    if (window.location.hash) {
        const targetId = window.location.hash.substring(1);
        const target = document.getElementById(targetId);
        if (target) {
            setTimeout(() => {
                target.scrollIntoView({ behavior: 'smooth' });
                if (history.replaceState) {
                    history.replaceState(null, null, window.location.pathname);
                }
            }, 150);
        }
    }
});

// --- COUNTDOWN TIMER (18.09.2026) ---
const countdownEl = document.getElementById('heroCountdown');
if (countdownEl) {
    const targetDate = new Date('2026-09-18T18:00:00-03:00').getTime();
    const daysEl = document.getElementById('cdDays');
    const hoursEl = document.getElementById('cdHours');
    const minEl = document.getElementById('cdMinutes');
    const secEl = document.getElementById('cdSeconds');

    function updateCountdown() {
        const now = new Date().getTime();
        const diff = targetDate - now;

        if (diff <= 0) {
            if (daysEl) daysEl.textContent = '00';
            if (hoursEl) hoursEl.textContent = '00';
            if (minEl) minEl.textContent = '00';
            if (secEl) secEl.textContent = '00';
            return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        if (daysEl) daysEl.textContent = String(days).padStart(2, '0');
        if (hoursEl) hoursEl.textContent = String(hours).padStart(2, '0');
        if (minEl) minEl.textContent = String(minutes).padStart(2, '0');
        if (secEl) secEl.textContent = String(seconds).padStart(2, '0');
    }

    updateCountdown();
    setInterval(updateCountdown, 1000);
}

// --- EVENT TRACKING (Meta Pixel & Google Analytics) ---
document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link) return;

    const href = link.getAttribute('href') || '';

    // Clique em WhatsApp de Promoter
    if (href.includes('wa.me')) {
        const card = link.closest('.promoter-card');
        const promoterName = card?.querySelector('.promoter-name')?.textContent.trim() || 'Promoter';
        const promoterCity = card?.querySelector('.promoter-city')?.textContent.replace(/[^a-zA-ZÀ-ÿ\s]/g, '').trim() || '';
        
        if (typeof fbq === 'function') {
            fbq('trackCustom', 'Click_Promoter_WhatsApp', { promoter: promoterName, city: promoterCity });
        }
        if (typeof gtag === 'function') {
            gtag('event', 'contact_promoter', { promoter_name: promoterName, city: promoterCity });
        }
    }
    // Clique em Compra BlackTag (Ingresso)
    else if (href.includes('blacktag.com.br/eventos/')) {
        if (typeof fbq === 'function') {
            fbq('track', 'InitiateCheckout', { content_name: 'Ingresso Zé Castanha IX' });
        }
        if (typeof gtag === 'function') {
            gtag('event', 'begin_checkout', { event_category: 'ecommerce', event_label: 'BlackTag' });
        }
    }
    // Clique na Lojinha Oficial
    else if (href.includes('store.blacktag.com.br')) {
        if (typeof fbq === 'function') {
            fbq('track', 'ViewContent', { content_name: 'Lojinha Oficial' });
        }
        if (typeof gtag === 'function') {
            gtag('event', 'view_store', { event_category: 'ecommerce', event_label: 'Lojinha Store' });
        }
    }
    // Clique em Caravanas (Google Forms)
    else if (href.includes('forms/d/e/') || href.includes('docs.google.com/forms')) {
        if (typeof fbq === 'function') {
            fbq('track', 'Lead', { content_name: 'Cadastro de Caravana' });
        }
        if (typeof gtag === 'function') {
            gtag('event', 'caravana_signup', { event_category: 'caravanas' });
        }
    }
    // Clique em Grupo VIP
    else if (href.includes('chat.whatsapp.com')) {
        if (typeof fbq === 'function') {
            fbq('trackCustom', 'Join_VIP_Group');
        }
        if (typeof gtag === 'function') {
            gtag('event', 'join_vip_group', { event_category: 'community' });
        }
    }
});
