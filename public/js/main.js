/* ===================================
   SAMPURNA AYURVEDIC - Main JavaScript
   Using Google Model Viewer for 3D
   =================================== */

document.addEventListener('DOMContentLoaded', () => {
    initParticles();
    initNavbar();
    initModelViewer();
    initContactForm();
    initSmoothScroll();
});

/* =================================
   Floating Particles
   ================================= */
function initParticles() {
    const particlesContainer = document.getElementById('particles');
    if (!particlesContainer) return;

    const leafEmojis = ['🍃', '🌿', '🍂', '🌱', '🍀'];
    const particleCount = 12;

    for (let i = 0; i < particleCount; i++) {
        createParticle(particlesContainer, leafEmojis);
    }

    setInterval(() => {
        if (particlesContainer.children.length < 15) {
            createParticle(particlesContainer, leafEmojis);
        }
    }, 4000);
}

function createParticle(container, leafEmojis) {
    const particle = document.createElement('span');
    particle.className = 'particle';
    particle.textContent = leafEmojis[Math.floor(Math.random() * leafEmojis.length)];

    particle.style.left = Math.random() * 100 + '%';
    particle.style.animationDuration = (15 + Math.random() * 15) + 's';
    particle.style.animationDelay = Math.random() * 5 + 's';
    particle.style.fontSize = (1 + Math.random() * 1.5) + 'rem';
    particle.style.opacity = 0.2 + Math.random() * 0.3;

    container.appendChild(particle);

    setTimeout(() => {
        if (particle.parentNode) {
            particle.remove();
        }
    }, 30000);
}

/* =================================
   Navbar Scroll Effect
   ================================= */
function initNavbar() {
    const navbar = document.getElementById('navbar');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const navLinks = document.querySelector('.nav-links');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 100) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            mobileMenuBtn.classList.toggle('active');
        });
    }
}

/* =================================
   Model Viewer Setup
   ================================= */
function initModelViewer() {
    const modelViewer = document.getElementById('bottleModel');
    if (!modelViewer) return;

    const productJourney = document.querySelector('.product-journey');
    const sections = document.querySelectorAll('.product-section');
    const progressDots = document.querySelectorAll('.progress-dot');

    let currentSectionIndex = 0;

    // Scroll-based rotation for model viewer
    let ticking = false;
    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(() => {
                updateModel();
                ticking = false;
            });
            ticking = true;
        }
    });

    function updateModel() {
        if (!productJourney) return;

        const journeyRect = productJourney.getBoundingClientRect();
        if (journeyRect.top > window.innerHeight || journeyRect.bottom < 0) return;

        let activeSectionIndex = 0;
        let maxVisibility = 0;

        sections.forEach((section, index) => {
            const rect = section.getBoundingClientRect();
            const sectionCenter = rect.top + rect.height / 2;
            const distance = Math.abs(window.innerHeight / 2 - sectionCenter);
            const visibility = 1 - (distance / window.innerHeight);

            if (visibility > maxVisibility) {
                maxVisibility = visibility;
                activeSectionIndex = index;
            }

            section.classList.toggle('active', visibility > 0.3);
        });

        if (activeSectionIndex !== currentSectionIndex) {
            currentSectionIndex = activeSectionIndex;
            progressDots.forEach((dot, i) => dot.classList.toggle('active', i === activeSectionIndex));
        }
    }

    // Progress dot clicks
    progressDots.forEach((dot, index) => {
        dot.addEventListener('click', () => {
            const sec = sections[index];
            if (sec) {
                const navH = document.getElementById('navbar').offsetHeight;
                window.scrollTo({ top: sec.getBoundingClientRect().top + window.pageYOffset - navH - 50, behavior: 'smooth' });
            }
        });
    });
}

/* =================================
   Contact Form
   ================================= */
function initContactForm() {
    const form = document.getElementById('contactForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = form.querySelector('button[type="submit"]');
        const orig = btn.innerHTML;
        btn.innerHTML = '<span>Sending...</span>';
        btn.disabled = true;

        const data = {
            name: document.getElementById('name').value,
            email: document.getElementById('email').value,
            interest: document.getElementById('interest').value,
            message: document.getElementById('message').value
        };

        try {
            const result = await ApiClient.post('/api/contact', data);
            btn.innerHTML = '<span>Message Sent! ✓</span>';
            btn.style.background = 'linear-gradient(135deg, #4a7c23, #2d5016)';
            form.reset();
            if (typeof showToast === 'function') showToast(result.message || 'Message sent successfully!');
        } catch (err) {
            btn.innerHTML = '<span>Failed to send ✕</span>';
            btn.style.background = 'linear-gradient(135deg, #c0392b, #962d22)';
            if (typeof showToast === 'function') showToast(err.message || 'Failed to send message', 'error');
        }

        setTimeout(() => { btn.innerHTML = orig; btn.style.background = ''; btn.disabled = false; }, 3000);
    });
}

/* =================================
   Smooth Scroll
   ================================= */
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            if (href === '#') return;
            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                const navH = document.getElementById('navbar').offsetHeight;
                window.scrollTo({ top: target.getBoundingClientRect().top + window.pageYOffset - navH, behavior: 'smooth' });
                document.querySelector('.nav-links')?.classList.remove('active');
            }
        });
    });
}

/* =================================
   Add to Cart Animation
   ================================= */
/* =================================
   Add to Cart Animation
   ================================= */
document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-primary');
    if (btn && btn.closest('.product-cta')) {
        // Just show the floating leaf animation, the actual checkout flow is handled by openCheckout()
        const floater = document.createElement('span');
        floater.textContent = '🌿';
        floater.style.cssText = `position:fixed;left:${e.clientX}px;top:${e.clientY}px;font-size:2.5rem;pointer-events:none;z-index:9999;animation:flyUp 1.2s ease forwards;`;
        document.body.appendChild(floater);
        setTimeout(() => floater.remove(), 1200);
    }
});

const style = document.createElement('style');
style.textContent = `@keyframes flyUp{0%{opacity:1;transform:scale(1) translateY(0) rotate(0deg)}100%{opacity:0;transform:scale(1.5) translateY(-150px) rotate(360deg)}}`;
document.head.appendChild(style);

/* =================================
   Telugu Translation Toggle
   ================================= */
let currentLanguage = 'en';

function toggleLanguage() {
    currentLanguage = currentLanguage === 'en' ? 'te' : 'en';

    // Toggle body class for Telugu font styling
    if (currentLanguage === 'te') {
        document.body.classList.add('telugu-active');
    } else {
        document.body.classList.remove('telugu-active');
    }

    // Get all translatable elements
    const translatables = document.querySelectorAll('.translatable, [data-en][data-te]');

    // Add switching class for fade out
    translatables.forEach(el => {
        el.classList.add('switching');
    });

    // After fade out, update text and fade in
    setTimeout(() => {
        translatables.forEach(el => {
            const text = el.getAttribute(`data-${currentLanguage}`);
            if (text) {
                el.textContent = text;
            }
            el.classList.remove('switching');
            el.classList.add('text-faded-in');

            // Remove animation class after animation completes
            setTimeout(() => {
                el.classList.remove('text-faded-in');
            }, 400);
        });
    }, 300);

    // Update nav links
    const navLinks = document.querySelectorAll('.nav-links a[data-en]');
    navLinks.forEach(link => {
        const text = link.getAttribute(`data-${currentLanguage}`);
        if (text) {
            link.textContent = text;
        }
    });

    // Update hero translate button
    const heroBtn = document.getElementById('heroTranslateBtn');
    const heroText = document.getElementById('heroTranslateText');
    if (heroBtn && heroText) {
        if (currentLanguage === 'te') {
            heroText.textContent = 'Read in English';
            heroBtn.classList.add('telugu-active');
        } else {
            heroText.textContent = 'తెలుగులో చదవండి';
            heroBtn.classList.remove('telugu-active');
        }
    }

    // Also update mobile button if exists
    const mobileBtn = document.getElementById('mobileTranslateBtn');
    const mobileText = document.getElementById('mobileTranslateText');
    if (mobileBtn && mobileText) {
        if (currentLanguage === 'te') {
            mobileText.textContent = 'English';
            mobileBtn.classList.add('telugu-active');
        } else {
            mobileText.textContent = 'తెలుగు';
            mobileBtn.classList.remove('telugu-active');
        }
    }
}
