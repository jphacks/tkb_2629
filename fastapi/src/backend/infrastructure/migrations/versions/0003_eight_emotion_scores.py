import sqlalchemy as sa
from alembic import op

revision = "0003_eight_emotion_scores"
down_revision = "0002_continuous_affect"
branch_labels = None
depends_on = None

EMOTION_NAMES = (
    "joy",
    "trust",
    "fear",
    "surprise",
    "sadness",
    "disgust",
    "anger",
    "anticipation",
)


def upgrade() -> None:
    with op.batch_alter_table("emotion_analyses") as batch_op:
        for emotion in EMOTION_NAMES:
            batch_op.add_column(sa.Column(emotion, sa.Float(), nullable=True))
            batch_op.create_check_constraint(
                f"ck_emotion_analyses_{emotion}",
                f"{emotion} IS NULL OR ({emotion} >= 0 AND {emotion} <= 1)",
            )


def downgrade() -> None:
    bind = op.get_bind()
    vector_columns = " OR ".join(f"{emotion} IS NOT NULL" for emotion in EMOTION_NAMES)
    has_vector_data = bind.execute(
        sa.text(f"SELECT EXISTS (SELECT 1 FROM emotion_analyses WHERE {vector_columns})")
    ).scalar_one()
    if has_vector_data:
        raise RuntimeError("Refusing to drop stored eight-emotion vectors")

    with op.batch_alter_table("emotion_analyses") as batch_op:
        for emotion in reversed(EMOTION_NAMES):
            batch_op.drop_constraint(f"ck_emotion_analyses_{emotion}", type_="check")
            batch_op.drop_column(emotion)