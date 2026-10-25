import sqlalchemy as sa
from alembic import op

revision = "0007_reading_iterations"
down_revision = "0006_google_books_id_only"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("user_books") as batch_op:
        batch_op.drop_constraint("uq_user_books_user_book", type_="unique")
        batch_op.add_column(
            sa.Column("iteration_number", sa.Integer(), server_default="1", nullable=False)
        )
        batch_op.create_unique_constraint(
            "uq_user_books_user_book_iteration",
            ["user_id", "book_id", "iteration_number"],
        )
        batch_op.create_check_constraint(
            "ck_user_books_iteration_positive",
            "iteration_number > 0",
        )

    op.create_index(
        "uq_user_books_active_reading",
        "user_books",
        ["user_id", "book_id"],
        unique=True,
        postgresql_where=sa.text("status = 'reading'"),
        sqlite_where=sa.text("status = 'reading'"),
    )


def downgrade() -> None:
    bind = op.get_bind()
    repeated_reading_count = bind.execute(
        sa.text(
            "SELECT count(*) FROM ("
            "SELECT user_id, book_id FROM user_books "
            "GROUP BY user_id, book_id HAVING count(*) > 1"
            ") AS repeated_readings"
        )
    ).scalar_one()
    if repeated_reading_count:
        raise RuntimeError("Refusing to discard repeated reading history")

    op.drop_index("uq_user_books_active_reading", table_name="user_books")
    with op.batch_alter_table("user_books") as batch_op:
        batch_op.drop_constraint("ck_user_books_iteration_positive", type_="check")
        batch_op.drop_constraint("uq_user_books_user_book_iteration", type_="unique")
        batch_op.drop_column("iteration_number")
        batch_op.create_unique_constraint(
            "uq_user_books_user_book",
            ["user_id", "book_id"],
        )
