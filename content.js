(function () {
    const m = location.pathname.match(/\/app\/(\d+)\b/);
    if (!m) return;
    const appId = m[1];

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

        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return "Just now";
    }

    function fmtDiff(value, label) {
        if (value == null || value === 0) return null;
        const sign = value > 0 ? "+" : "";
        return `${sign}${fmtInt(value)} ${label}`;
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
        const id = "gamalytic-overlay";
        if (document.getElementById(id)) return;

        const box = document.createElement("div");

        // Calculate position based on page width
        const pageWidth = window.innerWidth;
        const rightPosition =
            pageWidth > 1260 ? `${(pageWidth - 1260) / 2 + 12}px` : "12px";

        Object.assign(box.style, {
            position: "fixed",
            top: "150px",
            right: rightPosition,
            zIndex: "2147483647",
            background: "rgba(0,0,0,0.84)",
            color: "#fff",
            font: "12px/1.45 system-ui, -apple-system, Segoe UI, Arial",
            padding: "8px 10px",
            borderRadius: "6px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.45)",
            maxWidth: "200px",
            pointerEvents: "auto",
            whiteSpace: "nowrap",
            cursor: "pointer",
            transition: "all 0.2s ease",
        });
        box.id = id;
        box.title = "Open on Gamalytic";

        // Create compact view
        const compactView = document.createElement("div");
        compactView.style.display = "flex";
        compactView.style.flexDirection = "column";
        compactView.style.gap = "2px";
        compactView.style.fontSize = "11px";

        // Create detailed view
        const detailedView = document.createElement("div");
        detailedView.style.display = "none";
        detailedView.style.flexDirection = "column";
        detailedView.style.gap = "4px";

        // Add both views to box
        box.appendChild(compactView);
        box.appendChild(detailedView);

        // Hover events
        box.addEventListener("mouseenter", () => {
            compactView.style.display = "none";
            detailedView.style.display = "flex";
            box.style.maxWidth = "300px";
            box.style.padding = "10px 12px";
        });

        box.addEventListener("mouseleave", () => {
            compactView.style.display = "flex";
            detailedView.style.display = "none";
            box.style.maxWidth = "200px";
            box.style.padding = "8px 10px";
        });

        box.addEventListener("click", () => {
            const url = `https://gamalytic.com/game/${appId}`;
            window.open(url, "_blank", "noopener");
        });

        const line = (label, value, diffValue = null) => {
            const row = document.createElement("div");
            row.style.display = "flex";
            row.style.gap = "6px";
            const k = document.createElement("span");
            k.textContent = label + ":";
            k.style.opacity = "0.75";
            const v = document.createElement("span");
            v.textContent = value;
            v.style.fontWeight = "600";
            row.append(k, v);

            // Add difference if available
            if (diffValue !== null && diffValue !== 0) {
                const diff = document.createElement("span");
                diff.textContent = ` (${diffValue > 0 ? "+" : ""}${fmtInt(diffValue)})`;
                diff.style.fontSize = "12px";
                diff.style.opacity = "0.7";
                diff.style.color = diffValue > 0 ? "#4ade80" : "#f87171";
                row.append(diff);
            }

            return row;
        };

        // Compact view content
        if (released) {
            const soldText = `Sold: ${fmtCompact(copiesSold)}`;
            const revenueText = `Revenue: ${fmtCompact(revenue)}`;
            const reviewText = `Reviews: ${
                reviewScore ? Math.round(Number(reviewScore)) + "%" : "N/A"
            }`;

            compactView.innerHTML = `
                <div style="font-weight: 600;">${soldText}</div>
                <div style="font-weight: 600;">${revenueText}</div>
                <div style="font-weight: 600;">${reviewText}</div>
            `;
        } else {
            const wishlistText = `Wishlists: ${fmtCompact(wishlists)}`;
            compactView.innerHTML = `
                <div style="font-weight: 600;">${wishlistText}</div>
                <div style="font-weight: 600;">Status: Unreleased</div>
            `;
        }

        // Detailed view header
        const header = document.createElement("div");
        const gameTitle =
            document.querySelector(".apphub_AppName")?.textContent ||
            document.querySelector("h1")?.textContent ||
            `AppID ${appId}`;
        header.textContent = gameTitle;
        header.style.opacity = "0.8";
        header.style.marginBottom = "6px";
        header.style.fontWeight = "600";
        header.style.fontSize = "11px";
        header.style.maxWidth = "280px";
        header.style.overflow = "hidden";
        header.style.textOverflow = "ellipsis";
        header.style.whiteSpace = "nowrap";
        detailedView.append(header);

        // Add cache status and time info
        if (isCached) {
            const cacheInfo = document.createElement("div");
            cacheInfo.textContent = `Cached ${fmtTimeAgo(lastVisit)}`;
            cacheInfo.style.opacity = "0.6";
            cacheInfo.style.fontSize = "10px";
            cacheInfo.style.marginBottom = "4px";
            detailedView.append(cacheInfo);
        } else if (lastVisit) {
            const timeInfo = document.createElement("div");
            timeInfo.textContent = `Last seen ${fmtTimeAgo(lastVisit)}`;
            timeInfo.style.opacity = "0.6";
            timeInfo.style.fontSize = "10px";
            timeInfo.style.marginBottom = "4px";
            detailedView.append(timeInfo);
        }

        if (released) {
            detailedView.append(
                line("Copies sold", fmtInt(copiesSold), differences?.copiesSold),
                line("Gross revenue", fmtMoney(revenue), differences?.revenue),
                line(
                    "Review score",
                    reviewScore == null
                        ? "N/A"
                        : `${Math.round(Number(reviewScore))}% (${fmtInt(reviewCount)})`,
                    differences?.reviewCount
                )
            );

            // Show additional metrics if available
            if (peakPlayers) {
                detailedView.append(line("Peak players", fmtInt(peakPlayers)));
            }
            if (currentPlayers) {
                detailedView.append(line("Current players", fmtInt(currentPlayers)));
            }
        } else {
            // unreleased game
            if (!(Number(copiesSold) > 0)) {
                detailedView.append(
                    line("Wishlists", fmtInt(wishlists), differences?.wishlists)
                );
            }
            if (releaseDate) {
                detailedView.append(line("Release date", releaseDate));
            }
            detailedView.append(line("Status", "Unreleased"));
        }

        // post-release wishlists only if no sales data
        if (released && !(Number(copiesSold) > 0)) {
            detailedView.append(
                line("Wishlists", fmtInt(wishlists), differences?.wishlists)
            );
        }

        if (error) {
            const err = document.createElement("div");
            err.textContent = `API error: ${error}`;
            err.style.marginTop = "6px";
            err.style.opacity = "0.7";
            detailedView.append(err);
        }

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

        // Add resize listener to update position
        const updatePosition = () => {
            const pageWidth = window.innerWidth;
            const rightPosition =
                pageWidth > 1260 ? `${(pageWidth - 1260) / 2 + 12}px` : "12px";
            box.style.right = rightPosition;
        };

        window.addEventListener("resize", updatePosition);

        document.body.appendChild(box);
    }
})();
