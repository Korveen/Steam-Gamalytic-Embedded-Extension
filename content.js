(function () {
    const m = location.pathname.match(/\/app\/(\d+)\b/);
    if (!m) return;
    const appId = m[1];

    // Localization system
    const translations = {
        en: {
            title: "Gamalytic Analytics",
            error: "Error",
            copiesSold: "Copies sold",
            revenue: "Revenue",
            reviewScore: "Review score",
            peakPlayers: "Peak players",
            currentPlayers: "Current players",
            wishlists: "Wishlists",
            releaseDate: "Release date",
            status: "Status",
            unreleased: "Unreleased",
            cache: "Cache:",
            openOnGamalytic: "Open on Gamalytic →",
            reviews: "reviews",
            months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            timeAgo: {
                days: (n) => `${n}d ago`,
                hours: (n) => `${n}h ago`,
                minutes: (n) => `${n}m ago`,
                justNow: "Just now"
            }
        },
        ru: {
            title: "Gamalytic Analytics",
            error: "Ошибка",
            copiesSold: "Продано копий",
            revenue: "Доход",
            reviewScore: "Оценка",
            peakPlayers: "Пик игроков",
            currentPlayers: "Игроков сейчас",
            wishlists: "Списки желаний",
            releaseDate: "Дата выхода",
            status: "Статус",
            unreleased: "Не выпущено",
            cache: "Кэш:",
            openOnGamalytic: "Открыть на Gamalytic →",
            reviews: "отзывов",
            months: ['янв.', 'фев.', 'мар.', 'апр.', 'май', 'июн.', 'июл.', 'авг.', 'сен.', 'окт.', 'ноя.', 'дек.'],
            timeAgo: {
                days: (n) => `${n}д назад`,
                hours: (n) => `${n}ч назад`,
                minutes: (n) => `${n}м назад`,
                justNow: "Только что"
            }
        }
    };

    // Get current language from storage (default: en)
    let currentLang = 'en';

    // Get translation function
    function t(key) {
        return translations[currentLang]?.[key] || translations.ru[key] || key;
    }

    chrome.runtime.sendMessage({ type: "fetchGamalytic", appId }, (res) => {
        if (!res?.ok || !res.data) {
            drawOverlay({ appId, released: false, error: res?.error || "No data" });
            return;
        }

        const d = res.data;
        const previousData = res.previousData;
        const lastVisit = res.lastVisit;
        const cacheAge = res.cacheAge;
        const isCached = res.cached;

        const released = d.unreleased === false;

        const copiesSold =
            d.copiesSold ?? d.owners ?? d?.estimateDetails?.reviewBased ?? 0;

        const revenue =
            d.revenue ??
            d.totalRevenue ??
            d.grossRevenue ??
            d.netRevenue ??
            d?.estimateDetails?.revenue ??
            null;

        const reviewScore = d.reviewScore ?? d?.history?.at(-1)?.score ?? null;

        const reviewCount =
            d.reviewsSteam ?? d.reviews ?? d?.history?.at(-1)?.reviews ?? null;

        const wishlists = d.wishlists ?? d?.history?.at(-1)?.wishlists ?? null;

        // Additional metrics that might be available
        const peakPlayers = d.peakPlayers ?? d?.history?.at(-1)?.peakPlayers ?? null;
        const currentPlayers =
            d.currentPlayers ?? d?.history?.at(-1)?.currentPlayers ?? null;
        const price = d.price ?? d.currentPrice ?? null;
        const releaseDate = d.releaseDate ?? d.releasedAt ?? null;

        // Calculate differences if we have previous data
        let differences = null;
        if (previousData) {
            const prevReleased = previousData.unreleased === false;
            const prevCopiesSold =
                previousData.copiesSold ??
                previousData.owners ??
                previousData?.estimateDetails?.reviewBased ??
                0;
            const prevRevenue =
                previousData.revenue ??
                previousData.totalRevenue ??
                previousData.grossRevenue ??
                previousData.netRevenue ??
                previousData?.estimateDetails?.revenue ??
                null;
            const prevReviewScore =
                previousData.reviewScore ?? previousData?.history?.at(-1)?.score ?? null;
            const prevReviewCount =
                previousData.reviewsSteam ??
                previousData.reviews ??
                previousData?.history?.at(-1)?.reviews ??
                null;
            const prevWishlists =
                previousData.wishlists ??
                previousData?.history?.at(-1)?.wishlists ??
                null;

            differences = {
                copiesSold: Number(copiesSold) - Number(prevCopiesSold),
                revenue: Number(revenue) - Number(prevRevenue),
                reviewScore: Number(reviewScore) - Number(prevReviewScore),
                reviewCount: Number(reviewCount) - Number(prevReviewCount),
                wishlists: Number(wishlists) - Number(prevWishlists),
            };
        }

        drawOverlay({
            appId,
            released,
            copiesSold,
            revenue,
            reviewScore,
            reviewCount,
            wishlists,
            peakPlayers,
            currentPlayers,
            price,
            releaseDate,
            raw: d,
            differences,
            lastVisit,
            cacheAge,
            isCached,
        });
    });

    function fmtInt(v) {
        if (v == null || v === "N/A") return "N/A";
        const n = Number(v);
        return Number.isFinite(n) ? n.toLocaleString() : String(v);
    }

    function fmtCompact(v) {
        if (v == null || v === "N/A") return "N/A";
        const n = Number(v);
        if (!Number.isFinite(n)) return String(v);

        if (n >= 1000000) {
            return (n / 1000000).toFixed(1) + "m";
        } else if (n >= 1000) {
            return (n / 1000).toFixed(1) + "k";
        }
        return n.toLocaleString();
    }

    function fmtMoney(v) {
        if (v == null) return "N/A";
        const n = Number(v);
        return Number.isFinite(n) ? "$" + Math.round(n).toLocaleString() : String(v);
    }

    function fmtPrice(v) {
        if (v == null) return "N/A";
        const n = Number(v);
        return Number.isFinite(n) ? "$" + n.toFixed(2) : String(v);
    }

    function fmtTimeAgo(timestamp) {
        if (!timestamp) return null;
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / (1000 * 60));
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        const timeAgo = t('timeAgo');
        if (days > 0) return timeAgo.days(days);
        if (hours > 0) return timeAgo.hours(hours);
        if (minutes > 0) return timeAgo.minutes(minutes);
        return timeAgo.justNow;
    }

    function fmtDiff(value, label) {
        if (value == null || value === 0) return null;
        const sign = value > 0 ? "+" : "";
        return `${sign}${fmtInt(value)} ${label}`;
    }

    // Format release date to readable format
    function fmtDate(dateStr) {
        if (!dateStr) return "N/A";
        
        // Try to parse as ISO date string
        let date = null;
        if (typeof dateStr === 'string') {
            // Try ISO format first
            date = new Date(dateStr);
            if (isNaN(date.getTime())) {
                // Try timestamp
                const timestamp = parseInt(dateStr);
                if (!isNaN(timestamp)) {
                    date = new Date(timestamp * 1000); // if seconds
                    if (isNaN(date.getTime())) {
                        date = new Date(timestamp); // if milliseconds
                    }
                }
            }
        } else if (typeof dateStr === 'number') {
            date = new Date(dateStr > 10000000000 ? dateStr : dateStr * 1000);
        }

        if (!date || isNaN(date.getTime())) {
            return dateStr; // Return original if can't parse
        }

        // Format with localized months
        const months = t('months');
        const day = date.getDate();
        const month = months[date.getMonth()];
        const year = date.getFullYear();
        
        if (currentLang === 'ru') {
            return `${day} ${month} ${year} г.`;
        } else {
            return `${month} ${day}, ${year}`;
        }
    }

    // Find Steam's right sidebar info block
    function findSteamInfoBlock() {
        // Try multiple selectors for Steam's right column
        const selectors = [
            '.rightcol.game_rightcol',
            '.game_rightcol',
            '.rightcol',
            '[class*="rightcol"]',
            '.block_content',
        ];

        for (const selector of selectors) {
            const block = document.querySelector(selector);
            if (block) return block;
        }

        // Fallback: find block with publisher/developer info
        const devRow = document.querySelector('.dev_row');
        if (devRow) {
            return devRow.closest('.block_content') || devRow.parentElement;
        }

        return null;
    }

    // Find insertion point (after publisher block)
    function findInsertionPoint() {
        // Look for publisher row
        const publisherRow = document.querySelector('.dev_row:has(a[href*="/publisher/"])') ||
                            Array.from(document.querySelectorAll('.dev_row')).find(row => 
                                row.textContent.includes('ИЗДАТЕЛЬ') || 
                                row.textContent.includes('PUBLISHER')
                            );

        if (publisherRow) {
            return publisherRow.parentElement;
        }

        // Fallback: find any dev_row container
        const devRow = document.querySelector('.dev_row');
        if (devRow) {
            return devRow.parentElement;
        }

        // Last resort: find block_content
        return document.querySelector('.block_content');
    }

    function drawOverlay({
        appId,
        released,
        copiesSold,
        revenue,
        reviewScore,
        reviewCount,
        wishlists,
        peakPlayers,
        currentPlayers,
        price,
        releaseDate,
        error,
        raw,
        differences,
        lastVisit,
        cacheAge,
        isCached,
    }) {
        const id = "gamalytic-info-block";
        if (document.getElementById(id)) return;

        // Load language from storage before rendering
        chrome.storage.local.get(['gamalytic_lang'], (result) => {
            if (result.gamalytic_lang && (result.gamalytic_lang === 'ru' || result.gamalytic_lang === 'en')) {
                currentLang = result.gamalytic_lang;
            }

            // Wait for Steam page to load
            const tryInsert = () => {
                const container = findInsertionPoint();
                if (!container) {
                    setTimeout(tryInsert, 100);
                    return;
                }

                // Create main container with Steam tag-like styling
                const mainContainer = document.createElement("div");
                mainContainer.id = id;
                mainContainer.style.marginTop = "12px";
                mainContainer.style.marginBottom = "12px";
                mainContainer.style.paddingRight = "19px";
                mainContainer.style.width = "auto";
                mainContainer.style.maxWidth = "100%";
                mainContainer.style.boxSizing = "border-box";

                // Create inner block with blue background (like Steam tags)
                const infoBlock = document.createElement("div");
                infoBlock.style.backgroundColor = "#1b2838";
                infoBlock.style.borderRadius = "3px";
                infoBlock.style.padding = "12px";
                infoBlock.style.border = "1px solid #2a475e";
                infoBlock.style.width = "auto";
                infoBlock.style.maxWidth = "100%";
                infoBlock.style.boxSizing = "border-box";

                // Create header (без переключателя языка)
                const header = document.createElement("div");
                header.style.marginBottom = "10px";
                header.style.paddingBottom = "8px";
                header.style.borderBottom = "1px solid #2a475e";
                
                const headerTitle = document.createElement("div");
                headerTitle.textContent = t('title');
                headerTitle.style.color = "#66C0F4";
                headerTitle.style.fontSize = "13px";
                headerTitle.style.fontWeight = "600";
                headerTitle.style.letterSpacing = "0.5px";
                header.appendChild(headerTitle);

                // Create content container
                const contentContainer = document.createElement("div");
                contentContainer.style.display = "flex";
                contentContainer.style.flexDirection = "column";
                contentContainer.style.gap = "6px";

                // Helper to create metric row (Steam-style)
                const createMetricRow = (labelText, value, diffValue = null, link = null) => {
                    const row = document.createElement("div");
                    row.style.display = "flex";
                    row.style.justifyContent = "space-between";
                    row.style.alignItems = "flex-start";
                    row.style.marginBottom = "4px";

                    const labelDiv = document.createElement("div");
                    labelDiv.textContent = labelText;
                    labelDiv.style.color = "#8F98A0";
                    labelDiv.style.fontSize = "12px";
                    labelDiv.style.flexShrink = "0";
                    labelDiv.style.width = "140px";

                    const valueDiv = document.createElement("div");
                    valueDiv.style.flex = "1";
                    valueDiv.style.textAlign = "right";
                    valueDiv.style.display = "flex";
                    valueDiv.style.flexDirection = "column";
                    valueDiv.style.alignItems = "flex-end";
                    valueDiv.style.gap = "2px";

                    const valueSpan = document.createElement(link ? "a" : "span");
                    if (link) {
                        valueSpan.href = link;
                        valueSpan.target = "_blank";
                        valueSpan.style.color = "#66C0F4";
                        valueSpan.style.textDecoration = "none";
                        valueSpan.addEventListener("mouseenter", () => {
                            valueSpan.style.textDecoration = "underline";
                        });
                        valueSpan.addEventListener("mouseleave", () => {
                            valueSpan.style.textDecoration = "none";
                        });
                    } else {
                        valueSpan.style.color = "#FFFFFF";
                    }
                    valueSpan.textContent = value;
                    valueSpan.style.fontSize = "12px";
                    valueSpan.style.fontWeight = "500";

                    valueDiv.appendChild(valueSpan);

                    // Add difference if available
                    if (diffValue !== null && diffValue !== 0) {
                        const diffSpan = document.createElement("span");
                        diffSpan.textContent = `${diffValue > 0 ? "+" : ""}${fmtInt(diffValue)}`;
                        diffSpan.style.color = diffValue > 0 ? "#5C7E10" : "#A34C25";
                        diffSpan.style.fontSize = "11px";
                        diffSpan.style.fontWeight = "400";
                        valueDiv.appendChild(diffSpan);
                    }

                    row.appendChild(labelDiv);
                    row.appendChild(valueDiv);
                    return row;
                };

                // Add metrics based on game status
                if (error) {
                    contentContainer.appendChild(createMetricRow(t('error'), error));
                } else if (released) {
                    contentContainer.appendChild(
                        createMetricRow(t('copiesSold'), fmtInt(copiesSold), differences?.copiesSold)
                    );
                    if (revenue) {
                        contentContainer.appendChild(
                            createMetricRow(t('revenue'), fmtMoney(revenue), differences?.revenue)
                        );
                    }
                    if (reviewScore != null) {
                        const reviewText = `${Math.round(Number(reviewScore))}% (${fmtInt(reviewCount)})`;
                        contentContainer.appendChild(
                            createMetricRow(t('reviewScore'), reviewText, differences?.reviewCount)
                        );
                    }
                    if (peakPlayers) {
                        contentContainer.appendChild(createMetricRow(t('peakPlayers'), fmtInt(peakPlayers)));
                    }
                    if (currentPlayers) {
                        contentContainer.appendChild(createMetricRow(t('currentPlayers'), fmtInt(currentPlayers)));
                    }
                } else {
                    if (wishlists) {
                        contentContainer.appendChild(
                            createMetricRow(t('wishlists'), fmtInt(wishlists), differences?.wishlists)
                        );
                    }
                    if (releaseDate) {
                        contentContainer.appendChild(createMetricRow(t('releaseDate'), fmtDate(releaseDate)));
                    }
                    contentContainer.appendChild(createMetricRow(t('status'), t('unreleased')));
                }

                // Add cache info (smaller, at bottom)
                if (isCached && lastVisit) {
                    const cacheInfo = document.createElement("div");
                    cacheInfo.textContent = `${t('cache')} ${fmtTimeAgo(lastVisit)}`;
                    cacheInfo.style.color = "#6D7882";
                    cacheInfo.style.fontSize = "10px";
                    cacheInfo.style.marginTop = "8px";
                    cacheInfo.style.paddingTop = "8px";
                    cacheInfo.style.borderTop = "1px solid #2a475e";
                    cacheInfo.style.textAlign = "center";
                    contentContainer.appendChild(cacheInfo);
                }

                // Add link to Gamalytic
                const linkContainer = document.createElement("div");
                linkContainer.style.marginTop = "8px";
                linkContainer.style.paddingTop = "8px";
                linkContainer.style.borderTop = "1px solid #2a475e";
                linkContainer.style.textAlign = "center";
                
                const link = document.createElement("a");
                link.href = `https://gamalytic.com/game/${appId}`;
                link.target = "_blank";
                link.textContent = t('openOnGamalytic');
                link.style.color = "#66C0F4";
                link.style.fontSize = "11px";
                link.style.textDecoration = "none";
                link.style.fontWeight = "500";
                link.addEventListener("mouseenter", () => {
                    link.style.textDecoration = "underline";
                });
                link.addEventListener("mouseleave", () => {
                    link.style.textDecoration = "none";
                });
                linkContainer.appendChild(link);
                contentContainer.appendChild(linkContainer);

                // Assemble block
                infoBlock.appendChild(header);
                infoBlock.appendChild(contentContainer);
                mainContainer.appendChild(infoBlock);

                // Insert after publisher or at the end of container
                const publisherRow = container.querySelector('.dev_row:has(a[href*="/publisher/"])') ||
                                    Array.from(container.querySelectorAll('.dev_row')).find(row => 
                                        row.textContent.includes('ИЗДАТЕЛЬ') || 
                                        row.textContent.includes('PUBLISHER')
                                    );

                if (publisherRow && publisherRow.nextSibling) {
                    container.insertBefore(mainContainer, publisherRow.nextSibling);
                } else if (publisherRow) {
                    container.appendChild(mainContainer);
                } else {
                    container.appendChild(mainContainer);
                }
            };

            // Start trying to insert
            if (document.readyState === "loading") {
                document.addEventListener("DOMContentLoaded", tryInsert);
            } else {
                tryInsert();
            }
        });

        console.debug("[Gamalytic] Raw API response:", raw);
        console.debug("[Gamalytic] Extracted values:", {
            copiesSold,
            revenue,
            reviewScore,
            reviewCount,
            wishlists,
            peakPlayers,
            currentPlayers,
            price,
            releaseDate,
            released,
        });
    }
})();