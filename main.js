import { CARD_DB } from './cards.js';
/**
 * MF FIELD - 22nd Birthday Edition (Smooth Swipe Update)
 * UI配置の改善、手札のドラッグ・スワイプによる滑らかなスクロール対応
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const nextBtn = document.getElementById('nextPhaseBtn');
const actionBtn = document.getElementById('actionConfirmBtn');
const logEl = document.getElementById('log-text');
const uiLayer = document.getElementById('ui-layer');
const gameContainer = document.getElementById('game-container');
const eventOverlay = document.getElementById('event-overlay');
const endEventBtn = document.getElementById('endEventBtn');

const WIDTH = 1400;
const HEIGHT = 1050;
const CARD_W = 126;
const CARD_H = 182;
const SWAP_CARD_W = 100;
const SWAP_CARD_H = 144;
const MAX_HP = 100000;
const VISIBLE_HAND = 7;

const Y_ENEMY_FIELD = HEIGHT / 2 - CARD_H - 60; 
const Y_PLAYER_FIELD = HEIGHT / 2 + 60;         
const Y_HAND = HEIGHT - CARD_H - 30;            

canvas.width = WIDTH;
canvas.height = HEIGHT;

const PHASES = {
    DRAW: "ドローフェイズ",
    MAIN: "メインフェイズ",
    BATTLE: "バトルフェイズ",
    NEGOTIATION: "交渉フェイズ",
    HAND_ACTION: "アクションフェイズ",
    NEUTRAL: "ニュートラルターン",
    END: "エンドフェイズ",
    ENEMY_TURN: "相手のターン",
    GAME_OVER: "ゲーム終了"
};


const ALCHEMY_POOL = ["最終審判", "ﾒﾃｵｲﾝﾊﾟｸﾄ", "5000兆円", "点滴", "突然のﾒﾝﾃﾅﾝｽ", "実家からの仕送り", "完全蘇生"];

const gameState = {
    phase: PHASES.DRAW,
    turnCount: 1,
    // ★ handOffset を廃止し、ピクセル単位での滑らかなスクロール用変数を追加
    currentHandScrollX: 0,
    targetHandScrollX: 0,
    isNeutralEventActive: false,
    player: { hp: MAX_HP, hand: [], field: [null, null, null, null, null], status: { pain: 0, sleep: 0, stunned: 0, regen: 0, cannotAttack: false } },
    enemy: { hp: MAX_HP, hand: [], field: [null, null, null, null, null], status: { pain: 0, sleep: 0, stunned: 0, regen: 0, cannotAttack: false } },
    deckP: [],
    deckE: [],
    selection: { handIdx: null, targetIdx: null, mode: null, subTargets: [] }
};

// --- 手札スクロールのクランプ処理 ---
function clampHandScroll() {
    const p = gameState.player;
    const visibleW = VISIBLE_HAND * (CARD_W + 15) - 15;
    const totalW = p.hand.length * (CARD_W + 15) - 15;
    const maxScroll = Math.max(0, totalW - visibleW);
    
    if (gameState.targetHandScrollX > maxScroll) gameState.targetHandScrollX = maxScroll;
    if (gameState.targetHandScrollX < 0) gameState.targetHandScrollX = 0;
}

function roundRect(ctx, x, y, width, height, radius) {
    if (radius === undefined) radius = 5;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

function initDeck() {
    const create = () => {
        let d = [];
        CARD_DB.forEach(c => { for(let i=0; i<c.copies; i++) d.push({...c}); });
        return d.sort(() => Math.random() - 0.5);
    };
    gameState.deckP = create();
    gameState.deckE = create();
    drawCardToHand(5, 'player');
    drawCardToHand(5, 'enemy');
}

function drawCardToHand(n, target) {
    const p = target === 'player' ? gameState.player : gameState.enemy;
    const d = target === 'player' ? gameState.deckP : gameState.deckE;
    for(let i=0; i<n; i++) if(d.length > 0 && p.hand.length < 30) p.hand.push(d.pop());
    
    if (target === 'player') {
        const visibleW = VISIBLE_HAND * (CARD_W + 15) - 15;
        const totalW = p.hand.length * (CARD_W + 15) - 15;
        gameState.targetHandScrollX = Math.max(0, totalW - visibleW); // 新しいカードが見えるように右へスライド
        clampHandScroll();
    }
}

function addLog(t) { logEl.innerText = t; }

function resize() {
    const scale = Math.min(window.innerWidth / WIDTH, window.innerHeight / HEIGHT);
    gameContainer.style.width = (WIDTH * scale) + "px";
    gameContainer.style.height = (HEIGHT * scale) + "px";
    uiLayer.style.transform = `scale(${scale})`;
}

// 図鑑関連の関数
window.openZukan = function() {
    document.getElementById('zukan-modal').style.display = 'flex';
    const tabs = document.querySelectorAll('.zukan-tab-btn');
    tabs.forEach(t => t.classList.remove('active'));
    tabs[0].classList.add('active');
    showZukanTab('All', tabs[0]);
};

window.closeZukan = function() {
    document.getElementById('zukan-modal').style.display = 'none';
};

window.showZukanTab = function(type, btnElement) {
    const tabs = document.querySelectorAll('.zukan-tab-btn');
    tabs.forEach(t => t.classList.remove('active'));
    if (btnElement) btnElement.classList.add('active');

    const list = document.getElementById('zukan-list');
    list.innerHTML = '';
    
    CARD_DB.forEach(card => {
        if (type !== 'All' && card.type !== type) return;
        
        const item = document.createElement('div');
        item.style.background = '#222';
        item.style.borderLeft = `8px solid ${card.color || '#fff'}`;
        item.style.padding = '15px';
        item.style.borderRadius = '8px';
        item.style.display = 'flex';
        item.style.flexDirection = 'column';
        item.style.boxShadow = '0 4px 10px rgba(0,0,0,0.5)';

        let statsHTML = '';
        if (card.atk !== undefined) {
            statsHTML = `<span style="background:#e74c3c; padding:2px 8px; border-radius:10px; margin-right:5px;">⚔️ 攻撃: ${card.atk}</span>
                         <span style="background:#3498db; padding:2px 8px; border-radius:10px;">🛡️ 防御: ${card.def}</span>`;
        } else if (card.heal) {
            statsHTML = `<span style="background:#2ecc71; padding:2px 8px; border-radius:10px;">💖 回復: ${card.heal}</span>`;
        }

        let typeLabel = '';
        if (card.type === 'Monster') typeLabel = '👾 モンスター';
        else if (card.type === 'Magic') typeLabel = '🪄 マジック';
        else if (card.type === 'Trap') typeLabel = '🃏 トラップ';
        else if (card.type === 'Item') typeLabel = '🍵 アイテム';

        item.innerHTML = `
            <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <span style="font-size: 24px; font-weight: bold; color: ${card.color || '#fff'}">${card.name}</span>
                <span style="font-size: 14px; color: #ddd; background: #444; padding: 4px 8px; border-radius: 5px;">${typeLabel}</span>
            </div>
            <div style="font-size: 14px; margin-bottom: 12px; display: flex; gap: 5px; color: #fff; font-weight: bold;">
                ${statsHTML}
            </div>
            <div style="font-size: 18px; color: #eee; line-height: 1.5; flex-grow: 1;">
                ${card.desc}
            </div>
        `;
        list.appendChild(item);
    });
};

function handleStatus(target) {
    const p = target === 'player' ? gameState.player : gameState.enemy;
    const name = target === 'player' ? "あなた" : "CPU";
    let skip = false;

    p.status.cannotAttack = false; 

    if(p.status.regen > 0) {
        p.hp = Math.min(MAX_HP, p.hp + 5000);
        p.status.regen--;
        addLog(`🍵 【持続回復】${name}のHPが5000回復！(残り${p.status.regen}ターン)`);
    }

    if(p.status.pain > 0) {
        p.hp -= 7500;
        p.status.pain--;
        addLog(`☠️ 【疼痛】${name}は7500ダメージを受けた！`);
    }

    checkWinLoss();
    if(gameState.phase === PHASES.GAME_OVER) return true;

    if(p.status.sleep > 0) {
        p.status.sleep--;
        if(p.status.sleep === 0) {
            p.hp = MAX_HP;
            addLog(`💤 【睡眠】${name}は目覚め、HPが全回復した！`);
        } else {
            addLog(`💤 【睡眠】${name}は眠っている...`);
            skip = true;
        }
    } else if(p.status.stunned > 0) {
        p.status.stunned--;
        addLog(`⚡ 【スタン】${name}は動けない！`);
        skip = true;
    }
    return skip;
}

function cancelSelection() {
    const s = gameState.selection;
    if (gameState.phase === PHASES.HAND_ACTION) {
        if (s.mode === "TARGET_MY_MONSTER_RESTORE") gameState.phase = PHASES.BATTLE;
        else gameState.phase = PHASES.MAIN;
        actionBtn.style.display = 'none';
        nextBtn.disabled = false;
        actionBtn.disabled = true; 
    }
    s.handIdx = null;
    s.targetIdx = null;
    s.mode = null;
    s.subTargets = [];
    addLog("操作をキャンセルしました。");
}

function triggerNeutralTurn(isMagic = false) {
    gameState.phase = PHASES.NEUTRAL;
    gameState.isNeutralEventActive = true;
    eventOverlay.style.display = 'flex';
    nextBtn.disabled = true;
    addLog("🌩️ ニュートラルターン発生！");
    drawCardToHand(5, 'player');
    drawCardToHand(5, 'enemy');

    endEventBtn.onclick = () => {
        eventOverlay.style.display = 'none';
        gameState.isNeutralEventActive = false;
        nextBtn.disabled = false;
        if (isMagic) { gameState.phase = PHASES.MAIN; } 
        else { startPlayerTurn(); }
    };
}

function startHandAction(mode) {
    gameState.phase = PHASES.HAND_ACTION;
    gameState.selection.mode = mode;
    gameState.selection.subTargets = [];
    actionBtn.style.display = 'block';
    actionBtn.innerText = mode === "SWAP_UI" ? "強奪確定" : (mode === "DUMPING" ? "ポイ捨て確定" : "アクション確定");
    actionBtn.disabled = true;
    nextBtn.disabled = true;
}

function resolveHandAction() {
    const s = gameState.selection;
    const p = gameState.player;
    const e = gameState.enemy;

    if(s.mode === "ALCHEMY") {
        const removedIndices = [s.handIdx, ...s.subTargets];
        removedIndices.sort((a,b)=>b-a).forEach(idx => { if(idx !== undefined && idx !== null) p.hand.splice(idx, 1); });
        const newCard = CARD_DB.find(c => c.name === ALCHEMY_POOL[Math.floor(Math.random()*ALCHEMY_POOL.length)]);
        if(newCard) p.hand.push({...newCard});
        addLog(`🌟 錬金成功！【${newCard?.name || "未知のカード"}】を手に入れた！`);
    } else if(s.mode === "DISCARD_1" || s.mode === "DISCARD_2") {
        const removedIndices = [s.handIdx, ...s.subTargets];
        removedIndices.sort((a,b)=>b-a).forEach(idx => { if(idx !== undefined && idx !== null) p.hand.splice(idx, 1); });
        addLog("🗑️ 不要なカードを処分した。");
    } else if(s.mode === "DUMPING") {
        const passIdx = s.subTargets[0];
        const passedCard = p.hand[passIdx];
        
        if (passedCard) {
            const indices = [s.handIdx, passIdx].sort((a,b) => b - a);
            indices.forEach(idx => { if(idx !== undefined && idx !== null) p.hand.splice(idx, 1); });

            e.hand.push(passedCard);
            const alchemyCard = CARD_DB.find(c => c.name === "錬金術");
            if(alchemyCard) e.hand.push({...alchemyCard});
            
            addLog(`🚮 ポイ捨て完了！【${passedCard.name}】と錬金術を相手に渡しました。`);
        } else {
            addLog(`❌ エラー：渡すカードが正しく選択されませんでした。`);
        }
    } else if(s.mode === "SWAP_UI") {
        const pIdx = s.subTargets[0];
        const eIdx = s.subTargets[1];
        if (pIdx !== undefined && eIdx !== undefined && p.hand[pIdx] && e.hand[eIdx]) {
            const myCard = p.hand.splice(pIdx, 1)[0];
            const enCard = e.hand.splice(eIdx, 1)[0];
            p.hand.push(enCard);
            e.hand.push(myCard);
            addLog(`✅ 【${enCard.name}】を強奪し、【${myCard.name}】を押し付けた！`);
        } else {
            addLog(`❌ エラー：対象のカードが見つかりません。`);
        }
    }

    actionBtn.style.display = 'none';
    actionBtn.disabled = true;
    gameState.phase = PHASES.MAIN;
    nextBtn.disabled = false;
    s.handIdx = null; s.subTargets = []; s.mode = null;
    
    p.hand = p.hand.filter(c => c);
    e.hand = e.hand.filter(c => c);
    clampHandScroll();
}

window.proposeDeal = function(type) {
    document.getElementById('neg-selections').style.display = 'none';
    addLog("交渉中...");
    setTimeout(() => {
        if(Math.random() >= 0.5) {
            addLog("✅ 交渉成立！");
            resolveNegotiation(true, type, 'player');
        } else {
            addLog("❌ 拒否された！");
            resolveNegotiation(false, null, 'player');
        }
    }, 1000);
}

function resolveNegotiation(success, type, initiator) {
    document.getElementById('negotiation-modal').style.display = 'none';
    if(success) {
        if(type === 'HP6000') {
            if(initiator === 'player') { gameState.enemy.hp -= 6000; gameState.player.hp += 6000; }
            else { gameState.player.hp -= 6000; gameState.enemy.hp += 6000; }
        } else if(type === 'STUN') {
            if(initiator === 'player') gameState.enemy.status.stunned += 1;
            else gameState.player.status.stunned += 1;
        } else if(type === 'HAND_SWAP') {
            if(initiator === 'player') startHandAction("SWAP_UI");
            else cpuHandSwap();
        }
    } else {
        drawCardToHand(4, initiator);
        addLog("決裂の代償として4枚ドロー！");
    }
    if(gameState.phase !== PHASES.HAND_ACTION) {
        gameState.phase = initiator === 'player' ? PHASES.MAIN : PHASES.ENEMY_TURN;
        nextBtn.disabled = false;
        if(initiator === 'enemy') setTimeout(processEnemyTurn, 1000);
    }
    checkWinLoss();
}

function cpuHandSwap() {
    if(gameState.player.hand.length > 0 && gameState.enemy.hand.length > 0) {
        const myIdx = Math.floor(Math.random()*gameState.enemy.hand.length);
        const yourIdx = Math.floor(Math.random()*gameState.player.hand.length);
        const myC = gameState.enemy.hand.splice(myIdx, 1)[0];
        const yourC = gameState.player.hand.splice(yourIdx, 1)[0];
        if (myC && yourC) {
            gameState.enemy.hand.push(yourC);
            gameState.player.hand.push(myC);
            addLog(`CPUは【${yourC.name}】を奪い取った！`);
        }
    }
    gameState.player.hand = gameState.player.hand.filter(c => c);
    gameState.enemy.hand = gameState.enemy.hand.filter(c => c);
    clampHandScroll();
}

function checkRevival(playerObj, nameStr) {
    if (playerObj.hp > 0) return false;
    const reviveSpecials = ["FIRST_AID", "ELIXIR", "PERFECT_REVIVE"];
    
    for (let r of reviveSpecials) {
        let foundIdx = playerObj.field.findIndex(c => c && c.special === r);
        if (foundIdx !== -1) {
            executeRevival(playerObj, nameStr, r, 'field', foundIdx);
            return true;
        }
        foundIdx = playerObj.hand.findIndex(c => c && c.special === r);
        if (foundIdx !== -1) {
            executeRevival(playerObj, nameStr, r, 'hand', foundIdx);
            return true;
        }
    }
    return false;
}

function executeRevival(p, nameStr, specialType, location, idx) {
    const cardName = p[location][idx].name;
    if (location === 'field') p.field[idx] = null;
    if (location === 'hand') p.hand.splice(idx, 1);

    if (specialType === "FIRST_AID") {
        p.hp = 40000;
        if (p.status.pain < 3) p.status.pain = 2;
        addLog(`🚑 【${cardName}】発動！ ${nameStr}はHP40000で復活！(疼痛の副作用)`);
    } else if (specialType === "ELIXIR") {
        p.hp = 60000;
        p.status.pain = 0; p.status.sleep = 0; p.status.stunned = 0; p.status.regen = 0;
        if (p.hand.length <= 2) {
            p.hand = [];
        } else {
            for(let i = 0; i < 2; i++) {
                if (p.hand.length > 0) p.hand.splice(Math.floor(Math.random() * p.hand.length), 1);
            }
        }
        addLog(`💊 【${cardName}】発動！ ${nameStr}はHP60000で状態異常も回復！(手札喪失の代償)`);
    } else if (specialType === "PERFECT_REVIVE") {
        p.hp = MAX_HP;
        p.status.pain = 0; p.status.sleep = 0; p.status.stunned = 0;
        const b = p.hand.length;
        p.hand = p.hand.filter(c => c && c.type !== "Item" && c.special !== "HEAL_BOTH" && c.special !== "REGEN" && c.special !== "HEAL_MY_MONSTER");
        if (p.hand.length < b) {
            addLog(`✨ 【${cardName}】発動！ ${nameStr}は完全復活！戒めとして回復カードが消滅！`);
        } else {
            addLog(`✨ 【${cardName}】発動！ ${nameStr}は完全な状態で復活した！`);
        }
    }
    clampHandScroll();
}

function checkTrap(defendingField, attackerName) {
    for (let i = 0; i < 5; i++) {
        const card = defendingField[i];
        if (card && card.type === "Trap") {
            if (card.special === "CUNNING_PLAN") {
                addLog(`▶ 罠発動！【狡猾な計画】！`);
                defendingField[i] = null;
                return "CUNNING_PLAN"; 
            }
            if (card.special === "GUARD_KAITOU") {
                if (attackerName === "怪盗") {
                    addLog(`▶ 罠発動！【警備隊】！怪盗の攻撃を完全に無効化し防いだ！`);
                    defendingField[i] = null;
                    return "NULLIFY";
                }
            }
            if (card.special === "SCAPEGOAT") {
                addLog(`▶ 罠発動！【みがわり】！ダメージを完全に無効化して消滅した！`);
                defendingField[i] = null;
                return "NULLIFY"; 
            }
            if (card.special === "COMPLIANCE") {
                addLog(`▶ 罠発動！【コンプラ違反】！ ${attackerName} の攻撃力がこの戦闘のみ 0 になった！`);
                defendingField[i] = null;
                return "ATK_ZERO";
            }
            if (card.special === "MAINTENANCE") {
                addLog(`▶ 罠発動！【突然のﾒﾝﾃﾅﾝｽ】！攻撃は無効化され、ターンが強制終了した！`);
                defendingField[i] = null;
                return "END_TURN";
            }
            if (card.special === "FLAME") {
                addLog(`▶ 罠発動！【炎上】！ダメージを反射した！`);
                defendingField[i] = null;
                return "REFLECT";
            }
            if (card.special === "COUNTER_ATTACK") {
                addLog(`▶ 罠発動！【不当解雇】！ ${attackerName} は即座に破壊された！`);
                defendingField[i] = null;
                return "COUNTER";
            }
        }
    }
    return "NONE";
}

function drawAngelWhisperCards(targetStr) {
    const p = targetStr === 'player' ? gameState.player : gameState.enemy;
    const is51Percent = Math.random() < 0.51;
    
    for(let i=0; i<3; i++) {
        if(i === 0 && is51Percent) {
            p.hand.push({...CARD_DB.find(c => c.name === "天使のささやき")});
        } else {
            const d = targetStr === 'player' ? gameState.deckP : gameState.deckE;
            if(d.length > 0) {
                p.hand.push(d.pop());
            } else {
                const randomCard = CARD_DB[Math.floor(Math.random() * CARD_DB.length)];
                p.hand.push({...randomCard});
            }
        }
    }
    const name = targetStr === 'player' ? "あなた" : "CPU";
    if (is51Percent) {
        addLog(`👼 【天使のささやき】${name}は3枚ドロー！（天使のささやきを再入手！）`);
    } else {
        addLog(`👼 【天使のささやき】${name}は3枚ドロー！`);
    }
    p.hand = p.hand.filter(c => c);
    if(targetStr === 'player') clampHandScroll();
}

function drawCardGraphics(x, y, w, h, card, isHidden = false) {
    if (!card) return; 
    ctx.save();
    if (card.stunned > 0) { ctx.shadowBlur = 20; ctx.shadowColor = '#3498db'; }

    if (isHidden) {
        ctx.fillStyle = '#2c3e50';
        roundRect(ctx, x, y, w, h, 10);
        ctx.fill();
        ctx.strokeStyle = '#f1c40f';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${w > 100 ? 20 : 16}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText("裏向き", x + w/2, y + h/2 + 5);
    } else {
        ctx.fillStyle = card.color || '#95a5a6';
        if (card.hasAttacked) ctx.filter = 'grayscale(100%) opacity(0.5)';
        roundRect(ctx, x, y, w, h, 10);
        ctx.fill();
        ctx.filter = 'none';

        ctx.strokeStyle = card.type === "Trap" ? "#9b59b6" : (card.type === "Magic" ? "#2ecc71" : (card.type === "Item" ? "#ff9ff3" : "#fff"));
        ctx.lineWidth = 3;
        ctx.stroke();

        const isDarkColor = (card.color === '#000' || card.color === '#1a1a1a' || card.color === '#2c3e50' || card.color === '#c0392b');
        ctx.fillStyle = isDarkColor ? '#ffffff' : '#000000';
        ctx.textAlign = 'center';

        const nameStr = card.name || "不明";
        let titleSize = w > 100 ? 18 : 14;
        if (nameStr.length >= 6) titleSize -= 3;
        if (nameStr.length >= 8) titleSize -= 2;
        ctx.font = `bold ${titleSize}px sans-serif`;
        ctx.fillText(nameStr, x + w / 2, y + (w > 100 ? 35 : 25));

        let statSize = w > 100 ? 14 : 11;
        if (card.atk !== undefined) {
            ctx.font = `bold ${statSize}px monospace`;
            const displayDef = card.currentDef !== undefined ? card.currentDef : card.def;
            ctx.fillText(`A:${card.atk} D:${displayDef}`, x + w / 2, y + h - (w > 100 ? 15 : 12));
        } else {
            ctx.font = `italic ${statSize}px sans-serif`;
            ctx.fillText(`[${card.type || "Unknown"}]`, x + w / 2, y + h - (w > 100 ? 15 : 12));
        }
    }
    ctx.restore();
}

function update() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    drawTable();
    drawStats();
    drawField();
    drawHand();
    if (gameState.phase === PHASES.HAND_ACTION && gameState.selection.mode === "SWAP_UI") drawSwapOverlay();
    requestAnimationFrame(update);
}

function drawTable() {
    ctx.fillStyle = "#1e1e1e";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    
    ctx.strokeStyle = "#444";
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 5]);
    ctx.beginPath();
    ctx.moveTo(50, HEIGHT/2);
    ctx.lineTo(WIDTH-50, HEIGHT/2);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // TURN表示を中央のフェイズ名の下に移動
    ctx.fillStyle = "#fff";
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`TURN: ${gameState.turnCount}`, WIDTH/2, 100);

    ctx.fillStyle = "#f1c40f";
    ctx.font = "bold 36px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(gameState.phase, WIDTH/2, 60);
}

function drawStats() {
    const drawHPBar = (x, y, playerObj, label) => {
        const hp = playerObj.hp;
        const w = 260;
        const h = 35;
        const ratio = Math.max(0, hp / MAX_HP);
        
        ctx.fillStyle = "#333";
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = ratio > 0.2 ? "#2ecc71" : "#e74c3c";
        ctx.fillRect(x, y, w * ratio, h);
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);
        
        let statusIcons = "";
        if(playerObj.status.pain > 0) statusIcons += ` ☠️疼痛(${playerObj.status.pain})`;
        if(playerObj.status.sleep > 0) statusIcons += ` 💤睡眠(${playerObj.status.sleep})`;
        if(playerObj.status.stunned > 0) statusIcons += ` ⚡ｽﾀﾝ(${playerObj.status.stunned})`;
        if(playerObj.status.regen > 0) statusIcons += ` 🍵回復(${playerObj.status.regen})`;

        ctx.fillStyle = "#fff";
        ctx.font = "bold 20px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(`${label}: ${hp.toLocaleString()} ${statusIcons}`, x, y - 10);
    };

    drawHPBar(40, Y_ENEMY_FIELD - 50, gameState.enemy, "CPU");
    drawHPBar(40, Y_PLAYER_FIELD + CARD_H + 20, gameState.player, "YOU");
}

function drawField() {
    const fStartX = WIDTH/2 - (CARD_W * 5 + 20 * 4) / 2; 
    for(let i=0; i<5; i++) {
        const x = fStartX + i*(CARD_W+20);
        
        ctx.strokeStyle = "rgba(255,255,255,0.1)"; ctx.lineWidth = 2;
        ctx.strokeRect(x, Y_ENEMY_FIELD, CARD_W, CARD_H);
        if(gameState.enemy.field[i]) {
            const isHidden = gameState.enemy.field[i].type === "Trap" || ["FIRST_AID", "ELIXIR", "PERFECT_REVIVE"].includes(gameState.enemy.field[i].special);
            drawCardGraphics(x, Y_ENEMY_FIELD, CARD_W, CARD_H, gameState.enemy.field[i], isHidden);
        }
        
        ctx.strokeRect(x, Y_PLAYER_FIELD, CARD_W, CARD_H);
        if(gameState.player.field[i]) {
            drawCardGraphics(x, Y_PLAYER_FIELD, CARD_W, CARD_H, gameState.player.field[i]);
            if (gameState.selection.targetIdx === i) {
                ctx.save();
                ctx.strokeStyle = "#e74c3c"; ctx.lineWidth = 5;
                roundRect(ctx, x, Y_PLAYER_FIELD, CARD_W, CARD_H, 10);
                ctx.stroke();
                ctx.restore();
            }
        }
    }
}

function drawHand() {
    if (gameState.phase === PHASES.HAND_ACTION && gameState.selection.mode === "SWAP_UI") return;
    
    const p = gameState.player;
    const s = gameState.selection;
    if (p.hand.length === 0) return;
    
    // 滑らかなスクロールのイージング処理
    gameState.currentHandScrollX += (gameState.targetHandScrollX - gameState.currentHandScrollX) * 0.2;

    const visibleW = VISIBLE_HAND * (CARD_W + 15) - 15;
    const startX = WIDTH / 2 - visibleW / 2;

    // 表示領域をクリップ（はみ出たカードを隠す）
    ctx.save();
    ctx.beginPath();
    ctx.rect(startX - 15, Y_HAND - 50, visibleW + 30, CARD_H + 100);
    ctx.clip();

    p.hand.forEach((c, i) => {
        if (!c) return; 
        const x = startX + i * (CARD_W + 15) - gameState.currentHandScrollX;
        
        // 完全に画面外なら描画スキップ
        if (x + CARD_W < startX - 20 || x > startX + visibleW + 20) return;

        let dy = Y_HAND;
        if(s.handIdx === i || s.subTargets.includes(i)) dy -= 30;

        drawCardGraphics(x, dy, CARD_W, CARD_H, c);

        if(s.handIdx === i || s.subTargets.includes(i)) {
            ctx.save();
            ctx.strokeStyle = "#f1c40f"; ctx.lineWidth = 4;
            roundRect(ctx, x, dy, CARD_W, CARD_H, 10);
            ctx.stroke();
            ctx.restore();
        }
    });
    ctx.restore();

    // 下部にスライドバーを描画
    const totalW = p.hand.length * (CARD_W + 15) - 15;
    const maxScroll = Math.max(0, totalW - visibleW);
    if (maxScroll > 0) {
        ctx.fillStyle = "rgba(255,255,255,0.15)";
        const barY = Y_HAND + CARD_H + 20;
        roundRect(ctx, startX, barY, visibleW, 6, 3);
        ctx.fill();
        
        const thumbWidth = Math.max(40, visibleW * (visibleW / totalW));
        const thumbX = startX + (gameState.currentHandScrollX / maxScroll) * (visibleW - thumbWidth);
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        roundRect(ctx, thumbX, barY, thumbWidth, 6, 3);
        ctx.fill();
    }
}

function drawSwapOverlay() {
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    
    ctx.fillStyle = '#e74c3c'; ctx.font = 'bold 36px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText("奪いたい相手のカード", WIDTH / 2, 90);
    ctx.fillStyle = '#3498db';
    ctx.fillText("押し付ける自分のカード", WIDTH / 2, HEIGHT / 2 + 50);

    const eLen = gameState.enemy.hand.length;
    if (eLen > 0) {
        const eOverlap = Math.min(SWAP_CARD_W + 15, (WIDTH - 150) / eLen);
        const eX = WIDTH/2 - (eLen * eOverlap) / 2;
        gameState.enemy.hand.forEach((c, i) => {
            if(!c) return; 
            const isSel = gameState.selection.subTargets[1] === i;
            const cy = isSel ? 130 : 150;
            drawCardGraphics(eX + i*eOverlap, cy, SWAP_CARD_W, SWAP_CARD_H, c); 
            if (isSel) {
                ctx.strokeStyle = "#e74c3c"; ctx.lineWidth = 5;
                roundRect(ctx, eX + i*eOverlap, cy, SWAP_CARD_W, SWAP_CARD_H, 10); ctx.stroke();
            }
        });
    }

    const pLen = gameState.player.hand.length;
    if (pLen > 0) {
        const pOverlap = Math.min(SWAP_CARD_W + 15, (WIDTH - 150) / pLen);
        const pX = WIDTH/2 - (pLen * pOverlap) / 2;
        gameState.player.hand.forEach((c, i) => {
            if(!c) return; 
            const isSel = gameState.selection.subTargets[0] === i;
            const cy = isSel ? HEIGHT/2 + 80 : HEIGHT/2 + 100;
            drawCardGraphics(pX + i*pOverlap, cy, SWAP_CARD_W, SWAP_CARD_H, c); 
            if (isSel) {
                ctx.strokeStyle = "#3498db"; ctx.lineWidth = 5;
                roundRect(ctx, pX + i*pOverlap, cy, SWAP_CARD_W, SWAP_CARD_H, 10); ctx.stroke();
            }
        });
    }
}

// ==========================================
// ★ スワイプ・ドラッグ用イベントリスナー
// ==========================================
let isDraggingHand = false;
let touchStartX = 0;
let lastPointerX = 0;
let initialHandScrollX = 0;
let draggedDistance = 0;

canvas.addEventListener('pointerdown', e => {
    if (document.getElementById('zukan-modal').style.display === 'flex') return;
    if (gameState.isNeutralEventActive || gameState.phase === PHASES.ENEMY_TURN || gameState.phase === PHASES.GAME_OVER) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (WIDTH / rect.width);
    const y = (e.clientY - rect.top) * (HEIGHT / rect.height);

    // 手札エリア（スライドバー部分も含む）が触られたらドラッグ開始
    if (y > Y_HAND - 40 && y < HEIGHT) { 
        isDraggingHand = true;
        touchStartX = x;
        lastPointerX = x;
        initialHandScrollX = gameState.targetHandScrollX;
        draggedDistance = 0;
        canvas.style.cursor = 'grabbing';
    }
});

canvas.addEventListener('pointermove', e => {
    if (!isDraggingHand) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (WIDTH / rect.width);
    const dx = x - lastPointerX;
    draggedDistance += Math.abs(dx);
    lastPointerX = x;
    
    // 指を動かした方向（右へ動かすと、左のカードが見えるようにスクロール値が下がる）
    let newScroll = initialHandScrollX - (x - touchStartX);
    
    const p = gameState.player;
    const visibleW = VISIBLE_HAND * (CARD_W + 15) - 15;
    const totalW = p.hand.length * (CARD_W + 15) - 15;
    const maxScroll = Math.max(0, totalW - visibleW);
    
    // はみ出た時のバウンス（抵抗）表現
    if (newScroll < 0) newScroll *= 0.3;
    if (newScroll > maxScroll) newScroll = maxScroll + (newScroll - maxScroll) * 0.3;
    
    gameState.targetHandScrollX = newScroll;
});

canvas.addEventListener('pointerup', e => {
    if (isDraggingHand) {
        isDraggingHand = false;
        canvas.style.cursor = 'default';
        clampHandScroll();
        // 指を大きく動かした場合は「スワイプ操作」とみなし、カードのクリック処理は行わない
        if (draggedDistance > 15 || Math.abs(initialHandScrollX - gameState.targetHandScrollX) > 10) return;
    }
    
    // ここから先は「クリック（タップ）」と判定された場合の処理
    if (document.getElementById('zukan-modal').style.display === 'flex') return;
    if (gameState.isNeutralEventActive || gameState.phase === PHASES.ENEMY_TURN || gameState.phase === PHASES.GAME_OVER) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (WIDTH / rect.width);
    const y = (e.clientY - rect.top) * (HEIGHT / rect.height);
    
    if(gameState.phase === PHASES.MAIN) handleMainClick(x, y);
    else if(gameState.phase === PHASES.BATTLE) handleBattleClick(x, y);
    else if(gameState.phase === PHASES.HAND_ACTION) handleActionClick(x, y);
});

canvas.addEventListener('pointerleave', e => {
    if (isDraggingHand) {
        isDraggingHand = false;
        canvas.style.cursor = 'default';
        clampHandScroll();
    }
});

// PCのマウスホイール用
canvas.addEventListener('wheel', e => {
    if (document.getElementById('zukan-modal').style.display === 'flex') return;
    const p = gameState.player;
    const visibleW = VISIBLE_HAND * (CARD_W + 15) - 15;
    const totalW = p.hand.length * (CARD_W + 15) - 15;
    const maxScroll = Math.max(0, totalW - visibleW);
    
    if (maxScroll > 0) {
        gameState.targetHandScrollX += (e.deltaY + e.deltaX) * 0.8;
        clampHandScroll();
    }
}, {passive: true});
// ==========================================


function handleMainClick(x, y) {
    const p = gameState.player;
    const s = gameState.selection;
    let hit = false;
    
    const visibleW = VISIBLE_HAND * (CARD_W + 15) - 15;
    const startX = WIDTH / 2 - visibleW / 2;
    
    // スクロールに対応した手札のクリック判定
    if (x > startX && x < startX + visibleW && y > Y_HAND - 40 && y < Y_HAND + CARD_H) {
        const scrollAdjustedX = x - startX + gameState.currentHandScrollX;
        const idx = Math.floor(scrollAdjustedX / (CARD_W + 15));
        const cardStartX = idx * (CARD_W + 15);
        // カード間の隙間(15px)はクリック無効にする
        if (scrollAdjustedX >= cardStartX && scrollAdjustedX <= cardStartX + CARD_W) {
            if (idx >= 0 && idx < p.hand.length && p.hand[idx]) {
                hit = true;
                if (s.handIdx === idx) {
                    cancelSelection();
                } else {
                    s.handIdx = idx;
                    addLog(`▶ 【${p.hand[idx].name}】 ${p.hand[idx].desc || ""}`);
                }
            }
        }
    }

    if (hit) return;

    const fStartX = WIDTH/2 - (CARD_W * 5 + 20 * 4) / 2;
    for(let i=0; i<5; i++) {
        const sx = fStartX + i*(CARD_W+20);
        if(x > sx && x < sx + CARD_W && y > Y_PLAYER_FIELD && y < Y_PLAYER_FIELD + CARD_H) {
            hit = true;
            if(s.handIdx !== null) {
                const card = p.hand[s.handIdx];
                if (!card) break;
                if(["DISCARD_1", "DISCARD_2", "ALCHEMY"].includes(card.special) && p.hand.length < 3) {
                    addLog("手札が3枚以上必要です！");
                    break;
                }
                
                const isSetableMagic = card.type === "Magic" && ["FIRST_AID", "ELIXIR", "PERFECT_REVIVE"].includes(card.special);

                if(card.type === "Monster" || card.type === "Trap" || isSetableMagic) {
                    if(!p.field[i]) {
                        p.field[i] = {...card, currentDef: card.def || 0, hasAttacked: false};
                        p.hand.splice(s.handIdx, 1);
                        s.handIdx = null;
                        if(card.type === "Monster") addLog(`👾 【${card.name}】を場に出した！`);
                        else addLog(`🃏 カードを裏向きで伏せた！`);
                        clampHandScroll();
                    } else if (isSetableMagic) {
                        addLog(`💡 【${card.name}】はHPが0になった時に自動で発動します。（空きフィールドをタップで伏せることも可能）`);
                        s.handIdx = null;
                    }
                } else if(card.type === "Item") {
                    if (card.special === "REGEN") {
                        gameState.player.status.regen += 3;
                        addLog(`🍵 ${card.name}を飲んだ！3ターンの間、毎ターンHPが5000回復する！`);
                    } else if(card.special === "HEAL_BOTH") {
                        gameState.player.hp = Math.min(MAX_HP, gameState.player.hp + 7000);
                        gameState.enemy.hp = Math.min(MAX_HP, gameState.enemy.hp + 7000);
                        addLog(`💖 ${card.name}を使用！ お互いのHPが7000回復した！`);
                    } else {
                        gameState.player.hp = Math.min(MAX_HP, gameState.player.hp + (card.heal || 0));
                        addLog(`🍵 アイテム【${card.name}】を使用。HPが回復した！`);
                    }
                    p.hand.splice(s.handIdx, 1);
                    s.handIdx = null;
                    clampHandScroll();
                } else {
                    handleMagic(card, s.handIdx);
                }
            }
            break;
        }
    }

    if (!hit && s.handIdx !== null) cancelSelection();
}

function handleMagic(card, idx) {
    const p = gameState.player;
    if(card.special === "DISCARD_1") startHandAction("DISCARD_1");
    else if(card.special === "DISCARD_2") startHandAction("DISCARD_2");
    else if(card.special === "ALCHEMY") startHandAction("ALCHEMY");
    else if(card.special === "TRASH_BAG") {
        p.hand.splice(idx, 1);
        for(let j=0; j<3; j++) p.hand.push({...CARD_DB.find(c => c.name === "ガチャ爆死")});
        addLog("ゴミ袋開封！ガチャ爆死を3つ手に入れました。");
        gameState.targetHandScrollX = 9999; clampHandScroll();
    } else if(card.special === "DUMPING") {
        startHandAction("DUMPING");
        addLog("▶ ポイ捨て：相手に押し付けるカードを1枚選んでください。");
    } else if(card.special === "HIBERNATE") {
        p.hand.splice(idx, 1);
        p.status.sleep = 2;
        p.status.cannotAttack = true;
        addLog("冬眠カプセル！今ターンは攻撃できません。");
        clampHandScroll();
    } else if(card.special === "INFLICT_PAIN") {
        p.hand.splice(idx, 1);
        gameState.enemy.status.pain += 4;
        addLog(`呪詛の釘！相手に4ターンの疼痛を付与した！`);
        clampHandScroll();
    } else if(card.special === "FORCE_NEUTRAL") {
        p.hand.splice(idx, 1);
        addLog(`女神の恵み発動！強制的にニュートラルターン！`);
        triggerNeutralTurn(true);
        clampHandScroll();
    } else if(card.special === "PAY_HP_DRAW") {
        p.hand.splice(idx, 1);
        p.hp -= 10000; drawCardToHand(3, 'player');
        addLog(`課金！HP10000を支払い3枚ドロー！`);
    } else if(card.special === "SWAP_ATK_DEF") {
        p.hand.splice(idx, 1);
        gameState.enemy.field.forEach(m => { 
            if(m && m.type === "Monster") { const t = m.atk; m.atk = m.currentDef; m.currentDef = t; } 
        });
        addLog(`論点すり替え！相手モンスターの攻守が逆転した！`);
        clampHandScroll();
    } else if(card.special === "DEAL") {
        p.hand.splice(idx, 1);
        document.getElementById('negotiation-modal').style.display = 'flex';
        document.getElementById('neg-selections').style.display = 'grid';
        document.getElementById('neg-actions').style.display = 'none';
        nextBtn.disabled = true;
        clampHandScroll();
    } else if (card.special === "HEAT") {
        const mateIdx = p.hand.findIndex(c => c && c.name === "ぬるめのﾏﾃ茶");
        if (mateIdx !== -1) {
            const indices = [idx, mateIdx].sort((a,b) => b - a);
            indices.forEach(i => p.hand.splice(i, 1));
            p.hand.push({...CARD_DB.find(c => c.name === "あつあつﾏﾃ茶")});
            addLog("🔥 加熱成功！『ぬるめのﾏﾃ茶』が『あつあつﾏﾃ茶』に進化した！");
            clampHandScroll();
        } else {
            addLog("⚠️ 手札に『ぬるめのﾏﾃ茶』がありません！");
            gameState.selection.handIdx = null; 
        }
    } else if(card.special === "ANGEL_WHISPER") {
        p.hand.splice(idx, 1);
        drawAngelWhisperCards('player');
    } else if(card.special === "HEAL_MY_MONSTER") {
        gameState.phase = PHASES.HAND_ACTION;
        gameState.selection.mode = "TARGET_MY_MONSTER_HEAL";
        addLog("▶ 食後の一杯：体力を回復させる『味方モンスター』をタップしてください。");
    } else if(card.special === "IV") {
        addLog("⚠️ 点滴はバトルフェイズ終了時に自動的に使うことができます。");
        gameState.selection.handIdx = null;
    } else if(card.special === "REMOVE_TRAP") {
        gameState.phase = PHASES.HAND_ACTION;
        gameState.selection.mode = "TARGET_ENEMY_TRAP";
        addLog("▶ トンボがけ：撤去する『敵の罠カード（裏向き）』をタップしてください。");
    } else if(card.special === "CLEARANCE") {
        gameState.phase = PHASES.HAND_ACTION;
        gameState.selection.mode = "TARGET_ENEMY";
        addLog("▶ おつとめ品：対象の『敵モンスター』をタップしてください。");
    } else if(card.special === "FORCE_STUN") {
        gameState.phase = PHASES.HAND_ACTION;
        gameState.selection.mode = "TARGET_ENEMY_STUN";
        addLog("▶ テーザー銃：スタンさせる『敵モンスター』をタップしてください。");
    } else if(card.special === "BEADS") {
        gameState.phase = PHASES.HAND_ACTION;
        gameState.selection.mode = "TARGET_MY_YOGIBO";
        addLog("▶ ビーズ交換：進化させる味方の『Yogibo』をタップしてください。");
    } else if(card.special === "ATK_BUFF") {
        gameState.phase = PHASES.HAND_ACTION;
        gameState.selection.mode = "TARGET_MY_MONSTER_BUFF";
        addLog("▶ エネルギーチャージ：強化する『味方モンスター』をタップしてください。");
    }
}

function handleActionClick(x, y) {
    const s = gameState.selection;
    const p = gameState.player;
    const e = gameState.enemy;
    let hit = false;

    if(s.mode === "ALCHEMY" || s.mode === "DISCARD_2" || s.mode === "DISCARD_1" || s.mode === "DUMPING") {
        const visibleW = VISIBLE_HAND * (CARD_W + 15) - 15;
        const startX = WIDTH / 2 - visibleW / 2;
        
        if (x > startX && x < startX + visibleW && y > Y_HAND - 40 && y < Y_HAND + CARD_H) {
            const scrollAdjustedX = x - startX + gameState.currentHandScrollX;
            const idx = Math.floor(scrollAdjustedX / (CARD_W + 15));
            const cardStartX = idx * (CARD_W + 15);
            if (scrollAdjustedX >= cardStartX && scrollAdjustedX <= cardStartX + CARD_W) {
                if (idx >= 0 && idx < p.hand.length && p.hand[idx]) {
                    hit = true;
                    if(idx === s.handIdx) return;
                    if(s.subTargets.includes(idx)) {
                        s.subTargets = s.subTargets.filter(v => v !== idx);
                        actionBtn.disabled = true;
                    } else {
                        const limit = (s.mode === "DISCARD_1" || s.mode === "DUMPING") ? 1 : 2;
                        if(s.subTargets.length < limit) s.subTargets.push(idx);
                        if(s.subTargets.length === limit) actionBtn.disabled = false;
                    }
                }
            }
        }
        if (hit) return;
    } else if(s.mode === "SWAP_UI") {
        const eLen = e.hand.length;
        if (eLen > 0) {
            const eOverlap = Math.min(SWAP_CARD_W + 15, (WIDTH - 150) / eLen);
            const eX = WIDTH/2 - (eLen * eOverlap) / 2;
            for(let i=eLen-1; i>=0; i--) {
                const ex = eX + i*eOverlap;
                if(x > ex && x < ex + SWAP_CARD_W && y > 130 && y < 150 + SWAP_CARD_H) { s.subTargets[1] = i; hit = true; break; }
            }
        }
        const pLen = p.hand.length;
        if (pLen > 0) {
            const pOverlap = Math.min(SWAP_CARD_W + 15, (WIDTH - 150) / pLen);
            const pX = WIDTH/2 - (pLen * pOverlap) / 2;
            for(let i=pLen-1; i>=0; i--) {
                const px = pX + i*pOverlap;
                if(x > px && x < px + SWAP_CARD_W && y > HEIGHT/2 + 80 && y < HEIGHT/2 + 100 + SWAP_CARD_H) { s.subTargets[0] = i; hit = true; break; }
            }
        }
        if (s.subTargets[0] !== undefined && s.subTargets[1] !== undefined) actionBtn.disabled = false;
    } 
    else if(s.mode === "TARGET_ENEMY" || s.mode === "TARGET_ENEMY_STUN" || s.mode === "TARGET_ENEMY_TRAP") {
        const fStartX = WIDTH/2 - (CARD_W * 5 + 20 * 4) / 2;
        for(let i=0; i<5; i++) {
            const sx = fStartX + i*(CARD_W+20);
            if(x > sx && x < sx + CARD_W && y > Y_ENEMY_FIELD && y < Y_ENEMY_FIELD + CARD_H && e.field[i]) {
                hit = true;
                
                if (s.mode === "TARGET_ENEMY_TRAP") {
                    if (e.field[i].type !== "Trap" && !["FIRST_AID", "ELIXIR", "PERFECT_REVIVE"].includes(e.field[i].special)) {
                        addLog("⚠️ 対象は裏向きの伏せカードのみです！");
                        return;
                    }
                    addLog(`🧹 トンボがけ！敵の伏せカード【${e.field[i].name}】を見破り、撤去した！`);
                    e.field[i] = null;
                } else {
                    if (e.field[i].type !== "Monster") {
                        addLog("⚠️ 対象はモンスターのみです！");
                        return;
                    }
                    if (s.mode === "TARGET_ENEMY") {
                        e.field[i].atk = Math.floor(e.field[i].atk * 0.75);
                        addLog(`🌟 おつとめ品！${e.field[i].name}の攻撃力を3/4にしました！(ATK: ${e.field[i].atk})`);
                    } else {
                        e.field[i].stunned = 1;
                        addLog(`⚡ テーザー銃！${e.field[i].name}をスタンさせた！`);
                    }
                }
                
                p.hand.splice(s.handIdx, 1);
                p.hand = p.hand.filter(c => c); 
                s.mode = null; s.handIdx = null;
                gameState.phase = PHASES.MAIN; 
                clampHandScroll();
                break;
            }
        }
    } 
    else if(s.mode === "TARGET_MY_YOGIBO" || s.mode === "TARGET_MY_MONSTER_BUFF" || s.mode === "TARGET_MY_MONSTER_RESTORE" || s.mode === "TARGET_MY_MONSTER_HEAL") {
        const fStartX = WIDTH/2 - (CARD_W * 5 + 20 * 4) / 2;
        for(let i=0; i<5; i++) {
            const sx = fStartX + i*(CARD_W+20);
            if(x > sx && x < sx + CARD_W && y > Y_PLAYER_FIELD && y < Y_PLAYER_FIELD + CARD_H && p.field[i]) {
                hit = true;
                if (s.mode === "TARGET_MY_YOGIBO" && p.field[i].name === "Yogibo") {
                    p.field[i].name = "とろけるソファ"; p.field[i].atk = 5500; p.field[i].currentDef += 4000;
                    p.field[i].special = "ATTACK_STUN"; p.field[i].color = "#8e44ad"; p.field[i].desc = "攻撃時に相手をスタン";
                    addLog("✨ 進化！とろけるソファ降臨！");
                } else if (s.mode === "TARGET_MY_MONSTER_BUFF" && p.field[i].type === "Monster") {
                    p.field[i].atk += 5000;
                    addLog(`🔥 ${p.field[i].name}の攻撃力が5000アップ！`);
                } else if (s.mode === "TARGET_MY_MONSTER_HEAL" && p.field[i].type === "Monster") {
                    p.field[i].currentDef += 3000;
                    addLog(`🍵 ${p.field[i].name}の体力が3000回復した！`);
                } else if (s.mode === "TARGET_MY_MONSTER_RESTORE" && p.field[i].type === "Monster") {
                    if (p.field[i].hasAttacked) {
                        p.field[i].hasAttacked = false; 
                        addLog(`💉 ${p.field[i].name}に点滴！再び攻撃可能に！`);
                        p.hand.splice(s.handIdx, 1);
                        p.hand = p.hand.filter(c => c); 
                        s.mode = null; s.handIdx = null;
                        gameState.phase = PHASES.BATTLE; 
                        clampHandScroll();
                        return;
                    } else {
                        addLog("⚠️ 未行動のモンスターには使用できません！");
                        return;
                    }
                } else { break; } 
                
                p.hand.splice(s.handIdx, 1);
                p.hand = p.hand.filter(c => c); 
                s.mode = null; s.handIdx = null;
                gameState.phase = PHASES.MAIN; 
                clampHandScroll();
                break;
            }
        }
    }

    if (!hit && s.mode !== "SWAP_UI") cancelSelection();
}

function handleBattleClick(x, y) {
    const p = gameState.player;
    const e = gameState.enemy;
    const s = gameState.selection;
    let hit = false;

    if(p.status.cannotAttack) { addLog("今ターンは攻撃できません！"); return; }
    
    const fStartX = WIDTH/2 - (CARD_W * 5 + 20 * 4) / 2;
    for(let i=0; i<5; i++) {
        const sx = fStartX + i*(CARD_W+20);
        if(x > sx && x < sx + CARD_W && y > Y_PLAYER_FIELD && y < Y_PLAYER_FIELD + CARD_H && p.field[i] && !p.field[i].hasAttacked) {
            hit = true;
            if (s.targetIdx === i) {
                cancelSelection();
            } else if (p.field[i].type === "Monster") {
                s.targetIdx = i;
                addLog(`▶ 【${p.field[i].name}】で攻撃。ターゲット（敵モンスターか背景）をタップ！`);
            }
            return; 
        }
    }

    if(s.targetIdx !== null) {
        const attacker = p.field[s.targetIdx];
        
        for(let i=0; i<5; i++) {
            const sx = fStartX + i*(CARD_W+20);
            if(x > sx && x < sx + CARD_W && y > Y_ENEMY_FIELD && y < Y_ENEMY_FIELD + CARD_H && e.field[i]) {
                hit = true;
                if (e.field[i].type !== "Monster") {
                    addLog("⚠️ 罠や伏せカードは直接攻撃の対象に選べません！");
                    cancelSelection();
                    return;
                }

                const target = e.field[i];
                let trapRes = checkTrap(e.field, attacker.name);
                
                if (trapRes === "END_TURN") {
                    s.targetIdx = null; 
                    gameState.phase = PHASES.END;
                    setTimeout(() => { gameState.phase = PHASES.ENEMY_TURN; processEnemyTurn(); }, 1000);
                    return;
                } else if (trapRes === "REFLECT") {
                    p.hp -= attacker.atk;
                } else if (trapRes === "COUNTER") {
                    p.field[s.targetIdx] = null;
                } else if (trapRes !== "NULLIFY") {
                    const power = (trapRes === "ATK_ZERO") ? 0 : attacker.atk;
                    const dmg = power - target.currentDef;
                    target.currentDef -= power;
                    attacker.currentDef -= target.atk;
                    
                    if (trapRes === "CUNNING_PLAN") {
                        attacker.stunned = 1;
                        addLog(`⚡ 狡猾な計画発動！ ${attacker.name} はスタンした！`);
                    }

                    if (attacker.special === "ATTACK_STUN" && target.currentDef > 0) {
                        target.stunned = 1; addLog(`ソファの攻撃で敵がスタン！`);
                    }
                    if (attacker.special === "ATTACK_PAIN") {
                        e.status.pain += 2; addLog(`🔥 あつあつマテ茶の熱さで敵は疼痛状態に！`);
                    }

                    if(target.currentDef <= 0) {
                        e.field[i] = null;
                        if(dmg > 0) { 
                            if (trapRes === "CUNNING_PLAN") {
                                addLog(`🛡️ 狡猾な計画により、貫通ダメージ ${dmg} は無効化された！`);
                            } else {
                                e.hp -= dmg; addLog(`💥 貫通！CPUに ${dmg} ダメージ！`); 
                            }
                        }
                    }
                    if(attacker.currentDef <= 0) p.field[s.targetIdx] = null;
                }
                
                if(attacker) attacker.hasAttacked = true;
                s.targetIdx = null;
                checkWinLoss(); return;
            }
        }
        
        if(!hit && y < Y_ENEMY_FIELD && (!e.field.some(m => m && m.type === "Monster") || attacker.special === "DIRECT")) {
            hit = true;
            let trapRes = checkTrap(e.field, attacker.name);

            let isFukutsu = false;
            for(let j=0; j<5; j++) {
                if(e.field[j] && e.field[j].special === "HEAL_INSTEAD") {
                    isFukutsu = true; e.field[j] = null; break;
                }
            }

            if (trapRes === "END_TURN") {
                s.targetIdx = null; 
                gameState.phase = PHASES.END;
                setTimeout(() => { gameState.phase = PHASES.ENEMY_TURN; processEnemyTurn(); }, 1000);
                return;
            } else if (trapRes === "REFLECT") {
                p.hp -= attacker.atk;
            } else if (trapRes === "COUNTER") {
                p.field[s.targetIdx] = null;
            } else if (trapRes === "CUNNING_PLAN") {
                attacker.stunned = 1;
                addLog(`🛡️ 狡猾な計画！ダイレクトアタックは無効化され、${attacker.name}はスタンした！`);
            } else if (trapRes !== "NULLIFY") {
                const power = (trapRes === "ATK_ZERO") ? 0 : attacker.atk;
                if(isFukutsu) {
                    e.hp += power; addLog(`▶ 罠発動！【不屈の精神】相手のHPが回復！`);
                } else {
                    e.hp -= power; addLog(`💥 ダイレクトアタック！ ${power} ダメージ！`);
                    if (attacker.special === "ATTACK_STUN") { e.status.stunned += 1; addLog(`ソファの攻撃でCPU本体がスタン！`); }
                    if (attacker.special === "ATTACK_PAIN") { e.status.pain += 2; addLog(`🔥 マテ茶の熱さでCPU本体は疼痛状態に！`); }
                }
            }

            if(attacker) attacker.hasAttacked = true;
            s.targetIdx = null;
            checkWinLoss();
        }
    }

    if (!hit && s.targetIdx !== null) cancelSelection();
}

actionBtn.onclick = resolveHandAction;

window.useIV = function() {
    document.getElementById('iv-modal').style.display = 'none';
    const ivIndex = gameState.player.hand.findIndex(c => c && c.special === "IV");
    if (ivIndex !== -1) {
        gameState.phase = PHASES.HAND_ACTION;
        gameState.selection.mode = "TARGET_MY_MONSTER_RESTORE";
        gameState.selection.handIdx = ivIndex;
        addLog("▶ 点滴：再び行動させる味方モンスターをタップしてください。");
    } else {
        skipIV();
    }
};

window.skipIV = function() {
    document.getElementById('iv-modal').style.display = 'none';
    gameState.phase = PHASES.END;
    addLog("【エンドフェイズ】ターンを終了します...");
    setTimeout(() => { gameState.phase = PHASES.ENEMY_TURN; processEnemyTurn(); }, 1000);
};

nextBtn.onclick = () => {
    if(gameState.phase === PHASES.DRAW) {
        gameState.phase = PHASES.MAIN;
        addLog("▶ メインフェイズ：カードを配置、または魔法を使用できます。");
    }
    else if(gameState.phase === PHASES.MAIN) {
        if(gameState.turnCount === 1) {
            gameState.phase = PHASES.END;
            addLog("【エンドフェイズ】※1ターン目はお互いに攻撃できません。ターン終了...");
            setTimeout(() => { gameState.phase = PHASES.ENEMY_TURN; processEnemyTurn(); }, 1500);
        } else {
            gameState.phase = PHASES.BATTLE;
            addLog("⚔️ バトルフェイズ：攻撃する味方を選び、ターゲットをタップ！");
        }
    }
    else if(gameState.phase === PHASES.BATTLE) {
        const hasIV = gameState.player.hand.some(c => c && c.special === "IV");
        const hasAttackedMonster = gameState.player.field.some(m => m && m.type === "Monster" && m.hasAttacked);
        if (hasIV && hasAttackedMonster) {
            document.getElementById('iv-modal').style.display = 'flex';
        } else {
            skipIV();
        }
    }
};

function processEnemyTurn() {
    if(gameState.phase === PHASES.GAME_OVER) return;
    if(handleStatus('enemy')) { setTimeout(endEnemyTurn, 1500); return; }

    addLog("相手のターン...");
    setTimeout(() => {
        for (let i = gameState.enemy.hand.length - 1; i >= 0; i--) {
            const card = gameState.enemy.hand[i];
            if (!card) continue;
            if (card.type === 'Item') {
                if (card.special === "REGEN") {
                    if (gameState.enemy.hp < MAX_HP && gameState.enemy.status.regen === 0) {
                        gameState.enemy.status.regen += 3;
                        addLog(`🌟 CPUが【${card.name}】を使用！持続回復を得た！`);
                        gameState.enemy.hand.splice(i, 1);
                    }
                } else if (card.special === "HEAL_BOTH") {
                    if (gameState.enemy.hp < MAX_HP) {
                        gameState.player.hp = Math.min(MAX_HP, gameState.player.hp + 7000);
                        gameState.enemy.hp = Math.min(MAX_HP, gameState.enemy.hp + 7000);
                        addLog(`🌟 CPUが【${card.name}】を使用！お互いのHPが回復！`);
                        gameState.enemy.hand.splice(i, 1);
                    }
                } else if (gameState.enemy.hp < MAX_HP) {
                    gameState.enemy.hp = Math.min(MAX_HP, gameState.enemy.hp + card.heal);
                    addLog(`🌟 CPUが【${card.name}】を使用！HPを回復！`);
                    gameState.enemy.hand.splice(i, 1);
                }
            }
        }
        
        gameState.enemy.hand = gameState.enemy.hand.filter(c => c); 
        const negIdx = gameState.enemy.hand.findIndex(c => c && c.special === 'DEAL');
        if (negIdx !== -1) {
            gameState.enemy.hand.splice(negIdx, 1);
            gameState.enemy.hand = gameState.enemy.hand.filter(c => c); 
            startEnemyNegotiation();
            return; 
        }

        resumeEnemyTurn();
    }, 1200);
}

function startEnemyNegotiation() {
    gameState.phase = PHASES.NEGOTIATION;
    const cpuType = ['HP6000', 'HAND_SWAP', 'STUN'][Math.floor(Math.random() * 3)];
    let dealText = (cpuType === 'HP6000') ? "あなたのHPを6000奪う" : (cpuType === 'HAND_SWAP' ? "手札を1枚強奪する" : "あなたを1ターンスタンさせる");
    document.getElementById('neg-title').innerText = "⚖️ 厳正取引 - CPUが発動";
    document.getElementById('negotiation-modal').style.display = 'flex';
    document.getElementById('neg-selections').style.display = 'none';
    document.getElementById('neg-actions').style.display = 'grid';
    document.getElementById('neg-display').innerHTML = `CPUからの要求：<br><span style="color:#e74c3c;font-size:28px;font-weight:bold;">${dealText}</span>`;
    addLog(`CPU: 「取引をしようじゃないか。」`);
}

function resumeEnemyTurn() {
    if(gameState.phase === PHASES.GAME_OVER) return;
    
    for (let i = gameState.enemy.hand.length - 1; i >= 0; i--) {
        const magic = gameState.enemy.hand[i];
        if (magic && magic.type === 'Magic' && magic.special !== 'DEAL') {
            if (["DISCARD_1", "DISCARD_2", "ALCHEMY"].includes(magic.special) && gameState.enemy.hand.length < 3) continue;
            if (magic.special === "HEAL_MY_MONSTER" && !gameState.enemy.field.some(m => m && m.type === "Monster")) continue;
            if (magic.special === "REMOVE_TRAP" && !gameState.player.field.some(m => m && (m.type === "Trap" || ["FIRST_AID", "ELIXIR", "PERFECT_REVIVE"].includes(m.special)))) continue;

            if (["FIRST_AID", "ELIXIR", "PERFECT_REVIVE"].includes(magic.special)) continue;

            gameState.enemy.hand.splice(i, 1);
            addLog(`CPUが魔法【${magic.name}】を発動！`);
            
            if (magic.special === "HEAT") {
                const mateIdx = gameState.enemy.hand.findIndex(c => c && c.name === "ぬるめのﾏﾃ茶");
                if (mateIdx !== -1) {
                    gameState.enemy.hand.splice(mateIdx, 1);
                    gameState.enemy.hand.push({...CARD_DB.find(c => c.name === "あつあつﾏﾃ茶")});
                    addLog("🔥 CPUが『加熱』を使用！『あつあつﾏﾃ茶』を生み出した！");
                }
            } else if (magic.special === "ANGEL_WHISPER") {
                drawAngelWhisperCards('enemy');
            } else if (magic.special === "HEAL_MY_MONSTER") {
                let target = gameState.enemy.field.find(m => m && m.type === "Monster" && m.currentDef < m.def);
                if (!target) target = gameState.enemy.field.find(m => m && m.type === "Monster");
                if (target) {
                    target.currentDef += 3000;
                    addLog(`▶ CPUが ${target.name} の体力を3000回復！`);
                }
            } else if (magic.special === "REMOVE_TRAP") {
                const trapIdx = gameState.player.field.findIndex(m => m && (m.type === "Trap" || ["FIRST_AID", "ELIXIR", "PERFECT_REVIVE"].includes(m.special)));
                if (trapIdx !== -1) {
                    const trapName = gameState.player.field[trapIdx].name;
                    gameState.player.field[trapIdx] = null;
                    addLog(`🧹 CPUのトンボがけ！あなたの伏せカード【${trapName}】が撤去された！`);
                }
            } else if (magic.special === "DISCARD_1" || magic.special === "DISCARD_2") {
                const c = magic.special === "DISCARD_1" ? 1 : 2;
                for(let k=0; k<c; k++) if(gameState.enemy.hand.length>0) gameState.enemy.hand.pop();
            } else if (magic.special === "ALCHEMY") {
                if(gameState.enemy.hand.length>=2) {
                    gameState.enemy.hand.pop(); gameState.enemy.hand.pop();
                    const newCard = CARD_DB.find(c => c.name === ALCHEMY_POOL[Math.floor(Math.random()*ALCHEMY_POOL.length)]);
                    if (newCard) gameState.enemy.hand.push({ ...newCard });
                }
            } else if (magic.special === "INFLICT_PAIN") { gameState.player.status.pain += 4;
            } else if (magic.special === "FORCE_STUN") {
                const target = gameState.player.field.find(m => m && m.type === "Monster");
                if (target) target.stunned = 1;
            }
        }
    }

    gameState.enemy.hand = gameState.enemy.hand.filter(c => c); 

    for(let i=0; i<5; i++) {
        if(!gameState.enemy.field[i]) {
            const idx = gameState.enemy.hand.findIndex(c => c && (c.type === "Monster" || c.type === "Trap" || ["FIRST_AID", "ELIXIR", "PERFECT_REVIVE"].includes(c.special)));
            if(idx !== -1) {
                const c = gameState.enemy.hand.splice(idx, 1)[0];
                if (c) {
                    gameState.enemy.field[i] = {...c, currentDef: c.def || 0, hasAttacked: false};
                    if(c.type === "Trap" || ["FIRST_AID", "ELIXIR", "PERFECT_REVIVE"].includes(c.special)) addLog("🃏 CPUがカードを伏せた！");
                    else addLog(`👾 CPUがモンスターを配置！`);
                }
            }
        }
    }
    
    gameState.enemy.hand = gameState.enemy.hand.filter(c => c); 
    setTimeout(doEnemyBattle, 1000);
}

function doEnemyBattle() {
    if(gameState.phase === PHASES.GAME_OVER) return;
    let turnEnded = false;

    if (gameState.turnCount > 1 && !gameState.enemy.status.cannotAttack) {
        for(let i=0; i<5; i++) {
            const attacker = gameState.enemy.field[i];
            if(attacker && attacker.type === "Monster" && !attacker.hasAttacked && !turnEnded) {
                const targetIdx = gameState.player.field.findIndex(m => m !== null && m.type === "Monster");
                
                if (targetIdx !== -1) {
                    const target = gameState.player.field[targetIdx];
                    let trapRes = checkTrap(gameState.player.field, attacker.name);
                    
                    if (trapRes === "END_TURN") {
                        turnEnded = true;
                    }
                    else if (trapRes === "REFLECT") gameState.enemy.hp -= attacker.atk;
                    else if (trapRes === "COUNTER") gameState.enemy.field[i] = null;
                    else if (trapRes !== "NULLIFY") {
                        const power = (trapRes === "ATK_ZERO") ? 0 : attacker.atk;
                        const dmg = power - target.currentDef;
                        target.currentDef -= power;
                        attacker.currentDef -= target.atk;

                        if (trapRes === "CUNNING_PLAN") {
                            attacker.stunned = 1;
                            addLog(`⚡ 狡猾な計画発動！ ${attacker.name} はスタンした！`);
                        }
                        if (attacker.special === "ATTACK_STUN" && target.currentDef > 0) {
                            target.stunned = 1; addLog(`ソファの攻撃であなたがスタン！`);
                        }
                        if (attacker.special === "ATTACK_PAIN") {
                            gameState.player.status.pain += 2; addLog(`🔥 あつあつマテ茶の熱さであなたは疼痛状態に！`);
                        }

                        if(target.currentDef <= 0) {
                            gameState.player.field[targetIdx] = null;
                            if(dmg > 0) {
                                if (trapRes === "CUNNING_PLAN") {
                                    addLog(`🛡️ 狡猾な計画により、貫通ダメージ ${dmg} は無効化された！`);
                                } else {
                                    gameState.player.hp -= dmg;
                                    addLog(`💥 貫通！あなたに ${dmg} ダメージ！`);
                                }
                            }
                        }
                        if(attacker.currentDef <= 0) gameState.enemy.field[i] = null;
                    }
                } else {
                    let trapRes = checkTrap(gameState.player.field, attacker.name);
                    
                    let isFukutsu = false;
                    for(let j=0; j<5; j++) {
                        if(gameState.player.field[j] && gameState.player.field[j].special === "HEAL_INSTEAD") {
                            isFukutsu = true; gameState.player.field[j] = null; break;
                        }
                    }

                    if (trapRes === "END_TURN") {
                        turnEnded = true;
                    }
                    else if (trapRes === "REFLECT") gameState.enemy.hp -= attacker.atk;
                    else if (trapRes === "COUNTER") gameState.enemy.field[i] = null;
                    else if (trapRes === "CUNNING_PLAN") {
                        attacker.stunned = 1;
                        addLog(`🛡️ 狡猾な計画！ダイレクトアタックは無効化され、${attacker.name}はスタンした！`);
                    }
                    else if (trapRes !== "NULLIFY") {
                        const power = (trapRes === "ATK_ZERO") ? 0 : attacker.atk;
                        if (isFukutsu) {
                            gameState.player.hp = Math.min(MAX_HP, gameState.player.hp + power);
                            addLog(`▶ 罠発動！【不屈の精神】ダメージが回復に！`);
                        } else {
                            gameState.player.hp -= power;
                            addLog(`CPUのダイレクトアタック！`);
                            if (attacker.special === "ATTACK_STUN") { gameState.player.status.stunned += 1; addLog(`ソファの攻撃であなたはスタン！`); }
                            if (attacker.special === "ATTACK_PAIN") { gameState.player.status.pain += 2; addLog(`🔥 マテ茶の熱さであなたは疼痛状態に！`); }
                        }
                    }
                }
                if (attacker) attacker.hasAttacked = true;
                checkWinLoss();
            }
        }
    } else if (gameState.turnCount === 1) {
        addLog("※1ターン目なのでCPUは攻撃しません。");
    }
    
    setTimeout(endEnemyTurn, 1000);
}

function endEnemyTurn() {
    if(gameState.phase === PHASES.GAME_OVER) return;
    
    if (gameState.turnCount % 5 === 0) {
        triggerNeutralTurn(false);
    } else {
        startPlayerTurn();
    }
}

function startPlayerTurn() {
    gameState.turnCount++;
    if (handleStatus('player')) {
        if (gameState.phase !== PHASES.GAME_OVER) {
            gameState.phase = PHASES.END;
            setTimeout(processEnemyTurn, 1500);
        }
        return;
    }

    gameState.phase = PHASES.DRAW;
    gameState.player.field.forEach(m => { if(m) m.hasAttacked = false; });
    gameState.enemy.field.forEach(m => { if(m) m.hasAttacked = false; });
    drawCardToHand(3, 'player');
    drawCardToHand(3, 'enemy');
    addLog(`--- 第 ${gameState.turnCount} ターン ---`);
}

function checkWinLoss() {
    if (gameState.player.hp <= 0) checkRevival(gameState.player, "あなた");
    if (gameState.enemy.hp <= 0) checkRevival(gameState.enemy, "CPU");

    if(gameState.player.hp <= 0 && gameState.enemy.hp <= 0) showResult("DRAW");
    else if(gameState.player.hp <= 0) showResult("LOSE");
    else if(gameState.enemy.hp <= 0) showResult("WIN");
}

function showResult(txt) {
    gameState.phase = PHASES.GAME_OVER;
    document.getElementById('result-overlay').style.display = 'flex';
    document.getElementById('result-title').innerText = txt;
}

window.playerAccept = () => resolveNegotiation(true, gameState.negotiation?.currentDeal?.type || 'HAND_SWAP', 'enemy');
window.playerRefuse = () => resolveNegotiation(false, null, 'enemy');

resize();
initDeck();
update();
