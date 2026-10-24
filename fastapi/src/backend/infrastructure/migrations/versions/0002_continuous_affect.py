import sqlalchemy as sa
from alembic import op

revision = "0002_continuous_affect"
down_revision = "0001_reading_records"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("emotion_analyses") as batch_op:
        batch_op.alter_column(
            "emotion_label",
            existing_type=sa.String(length=64),
            nullable=True,
        )
        batch_op.add_column(sa.Column("valence", sa.Float(), nullable=True))
        batch_op.add_column(sa.Column("arousal", sa.Float(), nullable=True))
        batch_op.add_column(sa.Column("palette_version", sa.String(length=32), nullable=True))
        batch_op.create_check_constraint(
            "ck_emotion_analyses_valence", "valence IS NULL OR (valence >= -1 AND valence <= 1)"
        )
        batch_op.create_check_constraint(
            "ck_emotion_analyses_arousal", "arousal IS NULL OR (arousal >= -1 AND arousal <= 1)"
        )


def downgrade() -> None:
    bind = op.get_bind()
    has_continuous_data = bind.execute(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM emotion_analyses "
            "WHERE valence IS NOT NULL OR arousal IS NOT NULL OR palette_version IS NOT NULL "
            "OR emotion_label IS NULL)"
        )
    ).scalar_one()
    if has_continuous_data:
        raise RuntimeError("Refusing to drop stored continuous affect data")

    with op.batch_alter_table("emotion_analyses") as batch_op:
        batch_op.drop_constraint("ck_emotion_analyses_valence", type_="check")
        batch_op.drop_constraint("ck_emotion_analyses_arousal", type_="check")
        batch_op.drop_column("palette_version")
        batch_op.drop_column("arousal")
        batch_op.drop_column("valence")
        batch_op.alter_column(
            "emotion_label",
            existing_type=sa.String(length=64),
            nullable=False,
        )