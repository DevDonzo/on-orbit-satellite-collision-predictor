from ml.data_pipeline import build_current_satellite_positions, compute_collision_candidates


def main() -> None:
    satellites = build_current_satellite_positions()
    collisions = compute_collision_candidates()
    print(f"Satellites: {len(satellites)}")
    print(f"Collision pairs checked: {len(collisions)}")
    if collisions:
        print("Closest sample:", collisions[0].model_dump())


if __name__ == "__main__":
    main()
