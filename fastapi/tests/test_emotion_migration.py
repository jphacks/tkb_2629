import importlib

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations

from backend.domain.emotions import BASIC_EMOTION_NAMES, EmotionVector


def test_percentage_rounding():
    vector = EmotionVector(**dict.fromkeys(BASIC_EMOTION_NAMES, 0.125))
    assert vector.as_percentages() == dict.fromkeys(BASIC_EMOTION_NAMES, 13)


def test_existing_emotion_scores_migrate_and_downgrade():
    migration = importlib.import_module(
        "backend.infrastructure.migrations.versions.0008_emotion_percentages"
    )
    engine = sa.create_engine("sqlite://")
    metadata = sa.MetaData()
    table = sa.Table(
        "emotion_analyses",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("color_code", sa.String),
        *(sa.Column(name, sa.Float) for name in BASIC_EMOTION_NAMES),
        *(
            sa.CheckConstraint(
                f"{name} IS NULL OR ({name} >= 0 AND {name} <= 1)",
                name=f"ck_emotion_analyses_{name}",
            )
            for name in BASIC_EMOTION_NAMES
        ),
    )
    metadata.create_all(engine)
    with engine.begin() as connection:
        connection.execute(
            table.insert(),
            [
                {
                    "id": 1,
                    "color_code": "#ABCDEF",
                    **dict(
                        zip(
                            BASIC_EMOTION_NAMES,
                            [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 1],
                            strict=True,
                        )
                    ),
                },
                {"id": 2, "color_code": "#808080", **dict.fromkeys(BASIC_EMOTION_NAMES)},
            ],
        )
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
            row = (
                connection.execute(sa.text("SELECT * FROM emotion_analyses WHERE id = 1"))
                .mappings()
                .one()
            )
            assert [row[name] for name in BASIC_EMOTION_NAMES] == [0, 13, 25, 38, 50, 63, 75, 100]
            assert row["color_code"] == "#ABCDEF"
            assert all(
                isinstance(c["type"], sa.Integer)
                for c in sa.inspect(connection).get_columns("emotion_analyses")
                if c["name"] in BASIC_EMOTION_NAMES
            )
            null_row = connection.execute(
                sa.text("SELECT joy FROM emotion_analyses WHERE id = 2")
            ).scalar_one()
            assert null_row is None
            with pytest.raises(sa.exc.IntegrityError):
                connection.execute(sa.text("UPDATE emotion_analyses SET joy = 101 WHERE id = 1"))
            migration.downgrade()
            assert connection.execute(
                sa.text("SELECT trust FROM emotion_analyses WHERE id = 1")
            ).scalar_one() == pytest.approx(0.13)
