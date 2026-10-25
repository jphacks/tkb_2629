"""Store independent emotion intensities as integers from 0 to 100."""

import sqlalchemy as sa
from alembic import op

revision = "0008_emotion_percentages"
down_revision = "0007_reading_iterations"
branch_labels = None
depends_on = None

EMOTIONS = ("joy", "trust", "fear", "surprise", "sadness", "disgust", "anger", "anticipation")


def upgrade() -> None:
    with op.batch_alter_table("emotion_analyses") as batch:
        for name in EMOTIONS:
            batch.drop_constraint(f"ck_emotion_analyses_{name}", type_="check")

    assignments = ", ".join(f"{name} = CAST({name} * 100 + 0.5 AS INTEGER)" for name in EMOTIONS)
    op.execute(sa.text(f"UPDATE emotion_analyses SET {assignments}"))

    with op.batch_alter_table("emotion_analyses") as batch:
        for name in EMOTIONS:
            batch.alter_column(
                name,
                existing_type=sa.Float(),
                type_=sa.Integer(),
                existing_nullable=True,
                postgresql_using=f"{name}::integer",
            )
            batch.create_check_constraint(
                f"ck_emotion_analyses_{name}",
                f"{name} IS NULL OR ({name} >= 0 AND {name} <= 100)",
            )


def downgrade() -> None:
    with op.batch_alter_table("emotion_analyses") as batch:
        for name in EMOTIONS:
            batch.drop_constraint(f"ck_emotion_analyses_{name}", type_="check")
            batch.alter_column(
                name,
                existing_type=sa.Integer(),
                type_=sa.Float(),
                existing_nullable=True,
            )

    assignments = ", ".join(f"{name} = {name} / 100.0" for name in EMOTIONS)
    op.execute(sa.text(f"UPDATE emotion_analyses SET {assignments}"))

    with op.batch_alter_table("emotion_analyses") as batch:
        for name in EMOTIONS:
            batch.create_check_constraint(
                f"ck_emotion_analyses_{name}",
                f"{name} IS NULL OR ({name} >= 0 AND {name} <= 1)",
            )
