import sqlalchemy as sa
from alembic import op

revision = "0004_emotion_projection"
down_revision = "0003_eight_emotion_scores"
branch_labels = None
depends_on = None

PROJECTION_COLUMNS = ("projection_x", "projection_y", "coherence", "intensity")


def upgrade() -> None:
    with op.batch_alter_table("emotion_analyses") as batch_op:
        for column in PROJECTION_COLUMNS:
            batch_op.add_column(sa.Column(column, sa.Float(), nullable=True))
        batch_op.create_check_constraint(
            "ck_emotion_analyses_projection_x",
            "projection_x IS NULL OR (projection_x >= -1 AND projection_x <= 1)",
        )
        batch_op.create_check_constraint(
            "ck_emotion_analyses_projection_y",
            "projection_y IS NULL OR (projection_y >= -1 AND projection_y <= 1)",
        )
        batch_op.create_check_constraint(
            "ck_emotion_analyses_coherence",
            "coherence IS NULL OR (coherence >= 0 AND coherence <= 1)",
        )
        batch_op.create_check_constraint(
            "ck_emotion_analyses_intensity",
            "intensity IS NULL OR (intensity >= 0 AND intensity <= 1)",
        )


def downgrade() -> None:
    bind = op.get_bind()
    populated = " OR ".join(f"{column} IS NOT NULL" for column in PROJECTION_COLUMNS)
    has_projection_data = bind.execute(
        sa.text(f"SELECT EXISTS (SELECT 1 FROM emotion_analyses WHERE {populated})")
    ).scalar_one()
    if has_projection_data:
        raise RuntimeError("Refusing to drop stored emotion projection data")

    with op.batch_alter_table("emotion_analyses") as batch_op:
        for column in reversed(PROJECTION_COLUMNS):
            batch_op.drop_constraint(f"ck_emotion_analyses_{column}", type_="check")
            batch_op.drop_column(column)
