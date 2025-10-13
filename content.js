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

        const released = d.unreleased === false;

        const copiesSold =
            d.copiesSold ?? d.owners ?? d?.estimateDetails?.reviewBased ?? 0;

        const revenue = d.totalRevenue ?? d.revenue ?? null;

        const reviewScore = d.reviewScore ?? d?.history?.at(-1)?.score ?? null;

        const reviewCount =
            d.reviewsSteam ?? d.reviews ?? d?.history?.at(-1)?.reviews ?? null;

        const wishlists = d.wishlists ?? d?.history?.at(-1)?.wishlists ?? null;

        drawOverlay({
            appId,
            released,
            copiesSold,
            revenue,
            reviewScore,
            reviewCount,
            wishlists,
            raw: d,
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

        const line = (label, value) => {
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
            return row;
        };

        const header = document.createElement("div");
        header.textContent = `AppID ${appId}`;
        header.style.opacity = "0.8";
        header.style.marginBottom = "6px";
        header.style.fontWeight = "600";
        box.append(header);

        if (released) {
            box.append(
                line("Copies sold", fmtInt(copiesSold)),
                line("Gross revenue", fmtMoney(revenue)),
                line(
                    "Review score",
                    reviewScore == null
                        ? "N/A"
                        : `${Math.round(Number(reviewScore))}% (${fmtInt(reviewCount)})`
                )
            );
        } else {
            // unreleased game
            if (!(Number(copiesSold) > 0)) {
                box.append(line("Wishlists", fmtInt(wishlists)));
            }
            box.append(line("Status", "Unreleased"));
        }

        // post-release wishlists only if no sales data
        if (released && !(Number(copiesSold) > 0)) {
            box.append(line("Wishlists", fmtInt(wishlists)));
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
