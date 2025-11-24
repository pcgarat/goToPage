// Extensión Chrome - Navegador de Páginas
// Detecta paginadores y muestra barra flotante de navegación

(function() {
  'use strict';

  // Configuración por defecto
  const DEFAULT_RANGE = 10;
  const STORAGE_KEY = 'pageNavigatorRange';

  // Estado de la extensión
  let currentPage = 1;
  let totalPages = 1;
  let range = DEFAULT_RANGE;
  let paginatorInfo = null;
  let floatingBar = null;
  let observer = null;

  // Inicialización
  async function init() {
    // Cargar preferencias del usuario
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    range = result[STORAGE_KEY] || DEFAULT_RANGE;

    // Detectar paginador
    paginatorInfo = detectPaginator();
    
    if (paginatorInfo) {
      currentPage = paginatorInfo.currentPage;
      totalPages = paginatorInfo.totalPages;
      createFloatingBar();
      observeDOMChanges();
    }
  }

  // Detección de paginadores con múltiples patrones
  function detectPaginator() {
    const info = {
      currentPage: 1,
      totalPages: 1,
      pageLinks: [],
      urlPattern: null,
      baseUrl: window.location.href.split('?')[0].split('#')[0]
    };

    // Patrón 1: Detectar desde parámetros de URL
    const urlParams = new URLSearchParams(window.location.search);
    const pageParam = urlParams.get('page') || urlParams.get('p') || urlParams.get('pagina') || urlParams.get('pagenum');
    if (pageParam) {
      const pageNum = parseInt(pageParam, 10);
      if (!isNaN(pageNum) && pageNum > 0) {
        info.currentPage = pageNum;
        info.urlPattern = { param: urlParams.get('page') ? 'page' : (urlParams.get('p') ? 'p' : (urlParams.get('pagina') ? 'pagina' : 'pagenum')) };
      }
    }

    // Patrón 2: Buscar elementos de paginación en el DOM
    const paginationSelectors = [
      'nav[aria-label*="pagination" i]',
      'nav[aria-label*="páginas" i]',
      '.pagination',
      '.pager',
      '.page-navigation',
      '[class*="pagination"]',
      '[class*="pager"]',
      '[id*="pagination"]',
      '[id*="pager"]'
    ];

    let paginationContainer = null;
    for (const selector of paginationSelectors) {
      paginationContainer = document.querySelector(selector);
      if (paginationContainer) break;
    }

    if (paginationContainer) {
      // Buscar links de página
      const links = paginationContainer.querySelectorAll('a[href*="page"], a[href*="p="], a[href*="pagina"]');
      links.forEach(link => {
        const href = link.getAttribute('href');
        const pageMatch = href.match(/[?&](?:page|p|pagina|pagenum)=(\d+)/i);
        if (pageMatch) {
          const pageNum = parseInt(pageMatch[1], 10);
          info.pageLinks.push({ element: link, page: pageNum });
        }
      });

      // Buscar números de página en el texto
      const pageNumbers = paginationContainer.textContent.match(/\b(\d+)\b/g);
      if (pageNumbers) {
        const numbers = pageNumbers.map(n => parseInt(n, 10)).filter(n => n > 0 && n < 10000);
        if (numbers.length > 0) {
          const maxPage = Math.max(...numbers);
          if (maxPage > totalPages) {
            info.totalPages = maxPage;
          }
        }
      }

      // Buscar elemento activo/seleccionado
      const activeElement = paginationContainer.querySelector('.active, .current, .selected, [aria-current="page"]');
      if (activeElement) {
        const activeText = activeElement.textContent.trim();
        const activeMatch = activeText.match(/\b(\d+)\b/);
        if (activeMatch) {
          const activePage = parseInt(activeMatch[1], 10);
          if (!isNaN(activePage) && activePage > 0) {
            info.currentPage = activePage;
          }
        }
      }
    }

    // Patrón 3: Buscar links con texto "siguiente", "next", etc.
    const nextPrevLinks = document.querySelectorAll('a[href*="page"], a[href*="p="]');
    nextPrevLinks.forEach(link => {
      const text = link.textContent.toLowerCase().trim();
      const href = link.getAttribute('href');
      
      if (text.includes('next') || text.includes('siguiente') || text.includes('>')) {
        const pageMatch = href.match(/[?&](?:page|p|pagina|pagenum)=(\d+)/i);
        if (pageMatch) {
          const pageNum = parseInt(pageMatch[1], 10);
          if (pageNum > info.currentPage) {
            info.totalPages = Math.max(info.totalPages, pageNum);
          }
        }
      }
    });

    // Patrón 4: Detectar desde atributos data-page
    const dataPageElements = document.querySelectorAll('[data-page]');
    dataPageElements.forEach(el => {
      const pageNum = parseInt(el.getAttribute('data-page'), 10);
      if (!isNaN(pageNum) && pageNum > 0) {
        if (el.classList.contains('active') || el.classList.contains('current')) {
          info.currentPage = pageNum;
        }
        info.totalPages = Math.max(info.totalPages, pageNum);
        if (el.tagName === 'A') {
          info.pageLinks.push({ element: el, page: pageNum });
        }
      }
    });

    // Patrón 5: Buscar texto como "página X de Y" o "page X of Y"
    const pageTextPatterns = [
      /(?:página|page)\s+(\d+)\s+(?:de|of)\s+(\d+)/i,
      /(\d+)\s*\/\s*(\d+)/,
      /(\d+)\s+of\s+(\d+)/i
    ];

    if (paginationContainer) {
      const containerText = paginationContainer.textContent;
      for (const pattern of pageTextPatterns) {
        const match = containerText.match(pattern);
        if (match) {
          const current = parseInt(match[1], 10);
          const total = parseInt(match[2], 10);
          if (!isNaN(current) && !isNaN(total) && current > 0 && total > 0) {
            info.currentPage = current;
            info.totalPages = total;
            break;
          }
        }
      }
    }

    // Si no se detectó totalPages, intentar estimarlo desde la URL actual
    if (info.totalPages === 1 && info.currentPage > 1) {
      info.totalPages = info.currentPage + 10; // Estimación más generosa
    }

    // Si hay pageLinks pero totalPages es 1, usar el máximo de los links
    if (info.totalPages === 1 && info.pageLinks.length > 0) {
      const maxPageFromLinks = Math.max(...info.pageLinks.map(l => l.page));
      if (maxPageFromLinks > 1) {
        info.totalPages = maxPageFromLinks;
      }
    }

    // Validar que tenemos información suficiente
    // Mostrar si hay links de página detectados, o si hay parámetros de URL, o si currentPage > 1
    const hasPageLinks = info.pageLinks.length > 0;
    const hasUrlParam = info.urlPattern !== null;
    const hasMultiplePages = info.totalPages > 1;
    const isNotFirstPage = info.currentPage > 1;

    if (hasPageLinks || hasUrlParam || hasMultiplePages || isNotFirstPage) {
      // Asegurar que totalPages sea al menos igual a currentPage
      if (info.totalPages < info.currentPage) {
        // Si hay pageLinks, usar el máximo de ellos
        if (info.pageLinks.length > 0) {
          const maxPageFromLinks = Math.max(...info.pageLinks.map(l => l.page));
          info.totalPages = Math.max(maxPageFromLinks, info.currentPage + 5);
        } else {
          info.totalPages = info.currentPage + 5; // Estimación si no se detectó
        }
      }

      // Si totalPages es 1 pero hay pageLinks, actualizar
      if (info.totalPages === 1 && info.pageLinks.length > 0) {
        const maxPageFromLinks = Math.max(...info.pageLinks.map(l => l.page));
        if (maxPageFromLinks > 1) {
          info.totalPages = maxPageFromLinks;
        }
      }

      console.log('[PageNavigator] Paginador detectado:', {
        currentPage: info.currentPage,
        totalPages: info.totalPages,
        pageLinks: info.pageLinks.length,
        urlPattern: info.urlPattern
      });

      return info;
    }

    console.log('[PageNavigator] No se detectó paginador');
    return null;
  }

  // Crear barra flotante
  function createFloatingBar() {
    // Eliminar barra existente si existe
    if (floatingBar) {
      floatingBar.remove();
    }

    // Crear contenedor con Shadow DOM para aislamiento
    const container = document.createElement('div');
    container.id = 'page-navigator-container';
    const shadow = container.attachShadow({ mode: 'open' });

    // Crear estructura HTML
    const wrapper = document.createElement('div');
    wrapper.className = 'page-navigator-wrapper';

    // Botón de toggle (ocultar/mostrar)
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'page-navigator-toggle';
    toggleBtn.textContent = '◄';
    toggleBtn.title = 'Ocultar/Mostrar navegador';
    let isVisible = true;

    toggleBtn.addEventListener('click', () => {
      isVisible = !isVisible;
      wrapper.style.display = isVisible ? 'flex' : 'none';
      toggleBtn.textContent = isVisible ? '◄' : '►';
    });

    // Contenedor principal
    const mainContainer = document.createElement('div');
    mainContainer.className = 'page-navigator-main';

    // Input para ajustar rango
    const rangeContainer = document.createElement('div');
    rangeContainer.className = 'page-navigator-range';
    
    const rangeLabel = document.createElement('label');
    rangeLabel.textContent = 'Rango:';
    rangeLabel.setAttribute('for', 'range-input');
    
    const rangeInput = document.createElement('input');
    rangeInput.type = 'number';
    rangeInput.id = 'range-input';
    rangeInput.min = '1';
    rangeInput.max = '50';
    rangeInput.value = range;
    rangeInput.className = 'page-navigator-range-input';

    rangeInput.addEventListener('change', async (e) => {
      const newRange = parseInt(e.target.value, 10);
      if (!isNaN(newRange) && newRange >= 1 && newRange <= 50) {
        range = newRange;
        await chrome.storage.local.set({ [STORAGE_KEY]: range });
        updatePageButtons();
      } else {
        e.target.value = range;
      }
    });

    rangeContainer.appendChild(rangeLabel);
    rangeContainer.appendChild(rangeInput);

    // Contenedor de botones de página
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'page-navigator-buttons';
    buttonsContainer.id = 'page-buttons-container';

    mainContainer.appendChild(rangeContainer);
    mainContainer.appendChild(buttonsContainer);

    wrapper.appendChild(toggleBtn);
    wrapper.appendChild(mainContainer);

    // Aplicar estilos
    const style = document.createElement('style');
    style.textContent = getStyles();
    shadow.appendChild(style);
    shadow.appendChild(wrapper);

    document.body.appendChild(container);
    floatingBar = container;

    // Actualizar botones
    updatePageButtons();
  }

  // Actualizar botones de página
  function updatePageButtons() {
    if (!floatingBar) {
      console.log('[PageNavigator] No hay floatingBar');
      return;
    }

    const shadow = floatingBar.shadowRoot;
    if (!shadow) {
      console.log('[PageNavigator] No hay shadowRoot');
      return;
    }

    const buttonsContainer = shadow.querySelector('#page-buttons-container');
    if (!buttonsContainer) {
      console.log('[PageNavigator] No se encontró buttonsContainer');
      return;
    }

    // Limpiar botones existentes
    buttonsContainer.innerHTML = '';

    // Re-detectar paginador para asegurar datos actualizados
    const freshInfo = detectPaginator();
    if (freshInfo) {
      currentPage = freshInfo.currentPage;
      totalPages = freshInfo.totalPages;
      paginatorInfo = freshInfo;
    }

    // Si totalPages es 1 pero tenemos pageLinks, usar el máximo de los links
    if (totalPages === 1 && paginatorInfo && paginatorInfo.pageLinks.length > 0) {
      const maxPageFromLinks = Math.max(...paginatorInfo.pageLinks.map(l => l.page));
      if (maxPageFromLinks > totalPages) {
        totalPages = maxPageFromLinks;
        console.log(`[PageNavigator] totalPages actualizado desde pageLinks: ${totalPages}`);
      }
    }

    // Si totalPages es muy bajo pero currentPage es mayor, estimar mejor
    if (totalPages < currentPage + range) {
      // Si hay pageLinks, usar el máximo
      if (paginatorInfo && paginatorInfo.pageLinks.length > 0) {
        const maxPageFromLinks = Math.max(...paginatorInfo.pageLinks.map(l => l.page));
        if (maxPageFromLinks > totalPages) {
          totalPages = maxPageFromLinks;
        }
      }
      // Si aún es bajo, estimar generosamente
      if (totalPages < currentPage + range) {
        totalPages = currentPage + range + 5; // Estimación generosa
        console.log(`[PageNavigator] totalPages estimado: ${totalPages}`);
      }
    }

    // Si totalPages sigue siendo 1 y currentPage es 1, puede que realmente sea solo una página
    // Pero aún así, mostrar el rango solicitado por si hay más páginas
    if (totalPages === 1 && currentPage === 1) {
      // Asumir que puede haber más páginas y mostrar el rango
      totalPages = currentPage + range;
      console.log(`[PageNavigator] totalPages asumido para mostrar rango: ${totalPages}`);
    }

    // Calcular rango de páginas a mostrar
    // SIEMPRE mostrar currentPage ± range, sin limitar por totalPages detectado
    // El usuario puede navegar a páginas que aún no hemos detectado
    const startPage = Math.max(1, currentPage - range);
    const endPage = currentPage + range;
    
    // NO limitar por totalPages - siempre mostrar el rango completo
    // Si el usuario hace clic en una página que no existe, la navegación fallará naturalmente
    
    console.log(`[PageNavigator] Rango calculado: ${startPage} a ${endPage} (página actual: ${currentPage}, total detectado: ${totalPages})`);

    console.log(`[PageNavigator] Actualizando botones: página ${currentPage} de ${totalPages}, rango ${startPage}-${endPage}`);

    // Crear botones
    for (let page = startPage; page <= endPage; page++) {
      const button = document.createElement('button');
      button.className = 'page-navigator-button';
      if (page === currentPage) {
        button.classList.add('active');
      }
      button.textContent = page;
      button.title = `Ir a página ${page}`;

      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log(`[PageNavigator] Botón de página ${page} clickeado`);
        navigateToPage(page);
      });

      buttonsContainer.appendChild(button);
    }

    // Botón para primera página si no está visible
    if (startPage > 1) {
      const firstBtn = document.createElement('button');
      firstBtn.className = 'page-navigator-button page-navigator-special';
      firstBtn.textContent = '1';
      firstBtn.title = 'Ir a primera página';
      firstBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('[PageNavigator] Botón primera página clickeado');
        navigateToPage(1);
      });
      buttonsContainer.insertBefore(firstBtn, buttonsContainer.firstChild);
    }

    // Botón para última página si no está visible y sabemos cuál es
    // Solo mostrar si totalPages está bien detectado (mayor que endPage)
    if (totalPages > endPage && totalPages > 1) {
      const lastBtn = document.createElement('button');
      lastBtn.className = 'page-navigator-button page-navigator-special';
      lastBtn.textContent = totalPages;
      lastBtn.title = `Ir a última página (${totalPages})`;
      lastBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log(`[PageNavigator] Botón última página (${totalPages}) clickeado`);
        navigateToPage(totalPages);
      });
      buttonsContainer.appendChild(lastBtn);
    }

    console.log(`[PageNavigator] Botones creados: ${buttonsContainer.children.length}`);
  }

  // Navegar a una página específica
  function navigateToPage(page) {
    console.log(`[PageNavigator] Navegando a página ${page}`);
    
    if (page < 1 || page > totalPages || page === currentPage) {
      console.log(`[PageNavigator] Navegación cancelada: página inválida o igual a actual`);
      return;
    }

    // Intentar encontrar link existente en el paginador
    if (paginatorInfo && paginatorInfo.pageLinks.length > 0) {
      const link = paginatorInfo.pageLinks.find(l => l.page === page);
      if (link && link.element) {
        console.log(`[PageNavigator] Usando link existente para página ${page}`);
        link.element.click();
        // Re-detectaremos después de que la página cargue
        setTimeout(() => {
          const newInfo = detectPaginator();
          if (newInfo) {
            currentPage = newInfo.currentPage;
            totalPages = newInfo.totalPages;
            paginatorInfo = newInfo;
            updatePageButtons();
          }
        }, 1000);
        return;
      }
    }

    // Si no hay link, modificar la URL
    let targetUrl;
    if (paginatorInfo && paginatorInfo.urlPattern) {
      const url = new URL(window.location.href);
      url.searchParams.set(paginatorInfo.urlPattern.param, page.toString());
      targetUrl = url.toString();
    } else {
      // Intentar detectar patrón de URL
      const currentUrl = window.location.href;
      const url = new URL(currentUrl);
      
      // Probar diferentes parámetros comunes
      const params = ['page', 'p', 'pagina', 'pagenum'];
      let paramFound = false;
      
      for (const param of params) {
        if (url.searchParams.has(param)) {
          url.searchParams.set(param, page.toString());
          paramFound = true;
          break;
        }
      }
      
      if (!paramFound) {
        url.searchParams.set('page', page.toString());
      }
      
      targetUrl = url.toString();
    }

    console.log(`[PageNavigator] Navegando a: ${targetUrl}`);
    window.location.href = targetUrl;
  }

  // Observar cambios en el DOM
  function observeDOMChanges() {
    if (observer) {
      observer.disconnect();
    }

    let debounceTimer;
    observer = new MutationObserver(() => {
      // Debounce para evitar demasiadas actualizaciones
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        // Re-detectar paginador si cambia el DOM
        const newInfo = detectPaginator();
        if (newInfo) {
          const pageChanged = newInfo.currentPage !== currentPage;
          const totalChanged = newInfo.totalPages !== totalPages;
          
          currentPage = newInfo.currentPage;
          totalPages = newInfo.totalPages;
          paginatorInfo = newInfo;
          
          if (pageChanged || totalChanged) {
            console.log(`[PageNavigator] Cambio detectado: página ${currentPage} de ${totalPages}`);
            updatePageButtons();
          }
        }
      }, 300);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'aria-current', 'href']
    });

    // También escuchar cambios en la URL (navegación del navegador)
    window.addEventListener('popstate', () => {
      console.log('[PageNavigator] Cambio de URL detectado (popstate)');
      setTimeout(() => {
        const newInfo = detectPaginator();
        if (newInfo) {
          currentPage = newInfo.currentPage;
          totalPages = newInfo.totalPages;
          paginatorInfo = newInfo;
          updatePageButtons();
        }
      }, 500);
    });

    // Escuchar cuando la página se carga completamente
    window.addEventListener('load', () => {
      console.log('[PageNavigator] Página cargada completamente');
      setTimeout(() => {
        const newInfo = detectPaginator();
        if (newInfo) {
          currentPage = newInfo.currentPage;
          totalPages = newInfo.totalPages;
          paginatorInfo = newInfo;
          if (floatingBar) {
            updatePageButtons();
          } else {
            createFloatingBar();
          }
        }
      }, 1000);
    });
  }

  // Obtener estilos CSS
  function getStyles() {
    return `
      .page-navigator-wrapper {
        position: fixed;
        right: 0;
        top: 50%;
        transform: translateY(-50%);
        z-index: 999999;
        display: flex;
        flex-direction: row;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        font-size: 14px;
      }

      .page-navigator-toggle {
        background: #4a90e2;
        color: white;
        border: none;
        padding: 10px 5px;
        cursor: pointer;
        border-radius: 5px 0 0 5px;
        font-size: 12px;
        writing-mode: vertical-rl;
        text-orientation: mixed;
        transition: background 0.2s;
      }

      .page-navigator-toggle:hover {
        background: #357abd;
      }

      .page-navigator-main {
        background: white;
        border: 1px solid #ddd;
        border-radius: 0 5px 5px 0;
        box-shadow: -2px 2px 10px rgba(0, 0, 0, 0.1);
        display: flex;
        flex-direction: column;
        padding: 10px;
        min-width: 60px;
      }

      .page-navigator-range {
        display: flex;
        flex-direction: column;
        align-items: center;
        margin-bottom: 10px;
        padding-bottom: 10px;
        border-bottom: 1px solid #eee;
      }

      .page-navigator-range label {
        font-size: 11px;
        color: #666;
        margin-bottom: 5px;
      }

      .page-navigator-range-input {
        width: 50px;
        padding: 4px;
        border: 1px solid #ddd;
        border-radius: 3px;
        text-align: center;
        font-size: 12px;
      }

      .page-navigator-buttons {
        display: flex;
        flex-direction: column;
        gap: 5px;
        max-height: 70vh;
        overflow-y: auto;
        overflow-x: hidden;
      }

      .page-navigator-buttons::-webkit-scrollbar {
        width: 4px;
      }

      .page-navigator-buttons::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 2px;
      }

      .page-navigator-buttons::-webkit-scrollbar-thumb {
        background: #888;
        border-radius: 2px;
      }

      .page-navigator-buttons::-webkit-scrollbar-thumb:hover {
        background: #555;
      }

      .page-navigator-button {
        background: #f5f5f5;
        border: 1px solid #ddd;
        border-radius: 3px;
        padding: 8px 12px;
        cursor: pointer;
        font-size: 12px;
        min-width: 40px;
        transition: all 0.2s;
        text-align: center;
      }

      .page-navigator-button:hover {
        background: #e0e0e0;
        border-color: #4a90e2;
      }

      .page-navigator-button.active {
        background: #4a90e2;
        color: white;
        border-color: #357abd;
        font-weight: bold;
      }

      .page-navigator-button.page-navigator-special {
        background: #fff3cd;
        border-color: #ffc107;
        font-weight: bold;
      }

      .page-navigator-button.page-navigator-special:hover {
        background: #ffe69c;
      }
    `;
  }

  // Inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

