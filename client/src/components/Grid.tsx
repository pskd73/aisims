import { WorldState } from "../../../shared/types";
import StatusDisplay from "./StatusDisplay";

interface GridProps {
  worldState: WorldState;
  playerId: string;
}

const CELL_SIZE = 40;

function getDefaultAvatar(name: string): string {
  return name[0].toUpperCase();
}

function getModelInitials(model: string | undefined): string {
  if (!model) return "";
  return model
    .split(/[-_\s]+/)
    .map((word) => word[0]?.toUpperCase() || "")
    .filter(Boolean)
    .join("");
}

export default function Grid({ worldState, playerId }: GridProps) {
  const { players, objects, gridSize } = worldState;
  const currentPlayer = players.find((p) => p.id === playerId);

  return (
    <div
      className="grid-container"
      style={{
        width: gridSize.width * CELL_SIZE,
        height: gridSize.height * CELL_SIZE,
      }}
    >
      <div className="grid">
        {Array.from({ length: gridSize.height }).map((_, y) => (
          <div key={y} className="grid-row">
            {Array.from({ length: gridSize.width }).map((_, x) => {
              const isCurrentPlayer =
                currentPlayer?.position.x === x &&
                currentPlayer?.position.y === y;
              const playerHere = players.find(
                (p) => p.position.x === x && p.position.y === y
              );
              const objectsHere =
                objects?.filter(
                  (obj) => obj.position.x === x && obj.position.y === y
                ) || [];

              return (
                <div
                  key={x}
                  className={`grid-cell ${
                    isCurrentPlayer ? "current-player" : ""
                  }`}
                  style={{ width: CELL_SIZE, height: CELL_SIZE }}
                >
                  {objectsHere.length > 0 && (
                    <div className="objects-container">
                      {objectsHere.map((obj) => (
                        <div
                          key={obj.id}
                          className="object-sprite"
                          title={`${obj.type} placed by ${obj.placedByName}`}
                        >
                          {obj.emoji}
                        </div>
                      ))}
                    </div>
                  )}
                  {playerHere && (
                    <div
                      className={`player-sprite ${
                        isCurrentPlayer ? "self" : "other"
                      } ${playerHere.health === 0 ? "dead" : ""}`}
                      style={{ backgroundColor: playerHere.color }}
                      title={
                        playerHere.model
                          ? `${playerHere.name} - Model: ${playerHere.model}`
                          : playerHere.name
                      }
                    >
                      {playerHere.health === 0 ? (
                        <span className="player-dead">DEAD</span>
                      ) : (
                        <>
                          <span className="player-initial">
                            {playerHere.status?.emoji ||
                              getDefaultAvatar(playerHere.name)}
                          </span>
                          {playerHere.health !== undefined && (
                            <span className="player-health">
                              ❤️{playerHere.health}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {currentPlayer && (
        <div className="player-labels">
          {players.map((player) => (
            <div
              key={player.id}
              className={`player-label ${player.id === playerId ? "self" : ""}`}
              style={{
                left: player.position.x * CELL_SIZE + CELL_SIZE / 2,
                top: player.position.y * CELL_SIZE - 8,
              }}
            >
              {player.name}
            </div>
          ))}
        </div>
      )}

      {currentPlayer && (
        <div className="player-statuses">
          {players.map(
            (player) =>
              player.status && player.health !== 0 && (
                <div
                  key={player.id}
                  className={`player-status-wrapper ${
                    player.id === playerId ? "self" : ""
                  }`}
                  style={{
                    left: player.position.x * CELL_SIZE + CELL_SIZE / 2,
                    top: player.position.y * CELL_SIZE,
                  }}
                >
                  <StatusDisplay status={player.status} />
                </div>
              )
          )}
        </div>
      )}
    </div>
  );
}
