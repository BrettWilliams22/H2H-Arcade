export function Help({ onBack }: { onBack: () => void }) {
  return (
    <div className="screen menu-screen">
      <div className="panel prose">
        <h2>HOW TO PLAY</h2>
        <p>Break as many bricks as you can in 90 seconds. Highest score wins.</p>

        <h3>Controls</h3>
        <ul>
          <li>
            <b>Phone:</b> drag anywhere on or below the game to move; the paddle follows your finger. Tap to launch the
            ball, or touch with a second finger while steering.
          </li>
          <li>
            <b>Keyboard:</b> ← → (or A D) to move. Space or ↑ to launch. Esc or P to pause and resume.
          </li>
          <li>
            <b>Mouse:</b> move to steer. Click to launch.
          </li>
        </ul>
        <p>
          Where the ball hits the paddle aims it: the middle sends it nearly straight up, the edges send it out at an
          angle. Move while launching to angle your serve. If you don't launch, the ball goes by itself after 2
          seconds.
        </p>

        <h3>Bricks</h3>
        <ul className="legend">
          <li>
            <i className="swatch basic" /> Basic: 1 hit, 10 points
          </li>
          <li>
            <i className="swatch tough" /> Tough: 2 hits, 30 points
          </li>
          <li>
            <i className="swatch armored" /> Armored: 3 hits, 60 points
          </li>
          <li>
            <i className="swatch gold" /> Gold: 1 hit, 150 points
          </li>
          <li>
            <i className="swatch bomb" /> Bomb: 20 points, and destroys every brick around it
          </li>
        </ul>

        <h3>Scoring</h3>
        <ul>
          <li>Every 8 bricks in a row without losing the ball raises your multiplier, up to ×5.</li>
          <li>Losing the ball resets the multiplier and costs you time. There are no lives.</li>
          <li>Clearing all bricks scores 250 × the wave number, and a new, harder wave appears.</li>
        </ul>

        <h3>Fair play</h3>
        <p>
          In a match, both players get the same seed, so they see exactly the same bricks. Your device records only your
          moves. The server replays them to work out your score, so a score can't be faked.
        </p>

        <button type="button" className="btn primary" onClick={onBack}>
          BACK
        </button>
      </div>
    </div>
  );
}
