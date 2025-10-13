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

        const revenue = d.totalRevenue ?? d.revenue ?? null;

        const reviewScore = d.reviewScore ?? d?.history?.at(-1)?.score ?? null;

        const reviewCount =
            d.reviewsSteam ?? d.reviews ?? d?.history?.at(-1)?.reviews ?? null;

        const wishlists = d.wishlists ?? d?.history?.at(-1)?.wishlists ?? null;

        // Calculate differences if we have previous data
        let differences = null;
        if (previousData) {
            const prevReleased = previousData.unreleased === false;
            const prevCopiesSold =
                previousData.copiesSold ??
                previousData.owners ??
                previousData?.estimateDetails?.reviewBased ??
                0;
            const prevRevenue = previousData.totalRevenue ?? previousData.revenue ?? null;
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

    function fmtMoney(v) {
        if (v == null) return "N/A";
        const n = Number(v);
        return Number.isFinite(n) ? "$" + Math.round(n).toLocaleString() : String(v);
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
        Object.assign(box.style, {
            position: "fixed",
            top: "140px",
            right: "12px",
            zIndex: "2147483647",
            background: "rgba(0,0,0,0.84)",
            color: "#fff",
            font: "12px/1.45 system-ui, -apple-system, Segoe UI, Arial",
            padding: "10px 12px",
            borderRadius: "8px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.45)",
            maxWidth: "300px",
            pointerEvents: "auto",
            whiteSpace: "nowrap",
            cursor: "pointer",
        });
        box.id = id;
        box.title = "Open on Gamalytic";
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
        box.append(header);

        // Add cache status and time info
        if (isCached) {
            const cacheInfo = document.createElement("div");
            cacheInfo.textContent = `Cached ${fmtTimeAgo(lastVisit)}`;
            cacheInfo.style.opacity = "0.6";
            cacheInfo.style.fontSize = "10px";
            cacheInfo.style.marginBottom = "4px";
            box.append(cacheInfo);
        } else if (lastVisit) {
            const timeInfo = document.createElement("div");
            timeInfo.textContent = `Last seen ${fmtTimeAgo(lastVisit)}`;
            timeInfo.style.opacity = "0.6";
            timeInfo.style.fontSize = "10px";
            timeInfo.style.marginBottom = "4px";
            box.append(timeInfo);
        }

        if (released) {
            box.append(
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
        } else {
            // unreleased game
            if (!(Number(copiesSold) > 0)) {
                box.append(line("Wishlists", fmtInt(wishlists), differences?.wishlists));
            }
            box.append(line("Status", "Unreleased"));
        }

        // post-release wishlists only if no sales data
        if (released && !(Number(copiesSold) > 0)) {
            box.append(line("Wishlists", fmtInt(wishlists), differences?.wishlists));
        }

        if (error) {
            const err = document.createElement("div");
            err.textContent = `API error: ${error}`;
            err.style.marginTop = "6px";
            err.style.opacity = "0.7";
            box.append(err);
        }

        console.debug("[Gamalytic]", raw);
        document.body.appendChild(box);
    }
})();
