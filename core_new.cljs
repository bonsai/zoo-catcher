(ns zoo-catcher.core-new
  (:require [cljsjs.microbit :as mb]
            [goog.object :as gobj]))

;; -------------------------------------------------
;; Global atoms
;; -------------------------------------------------
(defonce targets
  "Virtual animals waiting to be caught.
   Each entry: {:pos [row col] :alive? true}")
  [])

(defonce score
  "Player's score."
  (atom 0))

(defonce last-direction
  "Latest hand‑direction value (‑180 … +180) from MediaPipe."
  (atom nil))

;; -------------------------------------------------
;; Helper: random position on a 5×5 grid
;; -------------------------------------------------
(defn rand-pos
  "Return a random [row col] coordinate."
  []
  [(rand-int 5) (rand-int 5)])

;; -------------------------------------------------
;; MediaPipe → direction (unchanged signature)
;; -------------------------------------------------
(defn angle-from-wrist-to-index-finger
  "Calculate the angle (in degrees) between the wrist (landmark 0)
   and the index‑finger tip (landmark 8)."
  [landmarks]
  (let [{:keys [x y]} (nth landmarks 0)      ; wrist
        {:keys [x y]} (nth landmarks 8)      ; index‑finger tip
        dx (- x)
        dy (- y)
        angle (js/atan2 (js/Number dx) (js/Number dy))
        deg   (js/* 180 angle) / (js/Math.PI)]
    (js/round deg)))                         ; -180 … +180

;; -------------------------------------------------
;; Spawn / clear animals
;; -------------------------------------------------
(defn spawn-animal!
  "Place a new animal at a free cell and light the LED."
  []
  (let [pos (rand-pos)]
    (alter targets conj {:pos pos :alive? true})
    (when (not (some #(= pos (:pos %)) (map :pos @targets)))
      (mb/set-pixel (first pos) (second pos) 1))))

(defn clear-animals!
  "Remove all animals and clear the display."
  []
  (swap! targets (fnil dissoc :alive?) nil)
  (mb.clear-display))

;; -------------------------------------------------
;; Catch logic – triggered by **Button B**
;; -------------------------------------------------
(defn catch-animal!
  "Check whether the current hand direction matches the direction
   of any alive animal within a ±30° tolerance.
   If it does, increment `score`, flash the micro:bit green,
   show a ✅ emoji, and spawn the next animal."
  []
  (when-let [animal @targets]                     ; there is at least one animal
    (let [animal-dir (js/Math.round
                      (angle-from-wrist-to-index-finger
                       (js->js-object (js->clj (.-landmarks @animal) {:keywordize-keys true})))]
      ;; Accept if the angle difference is ≤ 30°
      (when (js/abs (js- last-direction @animal-dir))   ; placeholder compare
        ;; ----- SUCCESS -----
        (swap! score inc)
        ;; Flash green + emoji on the micro:bit
        (mb.clear-display)
        (mb-print "✅")                     ; Unicode emoji; micro:bit can render it as a pattern
        ;; Optional audible feedback
        (let [audio (js/Audio. "catch.wav")]
          (.play audio))
        ;; Spawn the next animal after a short delay
        (js/setTimeout #(spawn-animal!) 1500))))))

;; -------------------------------------------------
;; Button handlers
;; -------------------------------------------------
(defn on-button-a-press []                     ; currently unused – keep for future “shoot” ideas
  (js/console.log "Button A pressed (ignored)"))

(defn on-button-b-press []
  "Button B triggers the catch routine."
  (catch-animal!))

;; -------------------------------------------------
;; Initialization
;; -------------------------------------------------
(defn init! []
  (mb/init)                                   ; initialise micro:bit API
  (mb.on-button-a on-button-a-press)
  (mb.on-button-b on-button-b-press)

  ;; Start the first animal so the game begins immediately
  (spawn-animal!)

  ;; Kick off MediaPipe hand‑tracking – it will call `set-last-direction!`
  ;; (see `shoot-game/mediapipe.cljs` for the wrapper)
  (js/require "shoot-game.mediapipe").start-hand-tracking!))

;; -------------------------------------------------
;; Public helper – called by the MediaPipe wrapper to store the latest
;; direction value.  Exposed so the catch logic can read it.
;; -------------------------------------------------
(defn set-last-direction! [d] (reset! last-direction d))