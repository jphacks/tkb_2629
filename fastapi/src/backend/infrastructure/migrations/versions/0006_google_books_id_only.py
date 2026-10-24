import sqlalchemy as sa
from alembic import op

revision = "0006_google_books_id_only"
down_revision = "0005_google_books_catalog"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("books") as batch_op:
        batch_op.drop_constraint("ck_books_title_nonempty", type_="check")
        batch_op.drop_constraint("ck_books_total_pages_positive", type_="check")
        batch_op.drop_constraint("uq_books_isbn_13", type_="unique")
        batch_op.alter_column(
            "title",
            existing_type=sa.String(length=255),
            nullable=True,
        )
        batch_op.alter_column(
            "total_pages",
            existing_type=sa.Integer(),
            nullable=True,
        )
        batch_op.drop_column("thumbnail_url")
        batch_op.drop_column("isbn_13")
        batch_op.create_check_constraint(
            "ck_books_title_nonempty",
            "google_books_id IS NOT NULL OR "
            "(title IS NOT NULL AND length(trim(title)) > 0)",
        )
        batch_op.create_check_constraint(
            "ck_books_total_pages_positive",
            "google_books_id IS NOT NULL OR "
            "(total_pages IS NOT NULL AND total_pages >= 1)",
        )

    op.execute(
        sa.text(
            "UPDATE books SET title = NULL, author = NULL, total_pages = NULL "
            "WHERE google_books_id IS NOT NULL"
        )
    )


def downgrade() -> None:
    bind = op.get_bind()
    external_book_count = bind.execute(
        sa.text("SELECT count(*) FROM books WHERE google_books_id IS NOT NULL")
    ).scalar_one()
    if external_book_count:
        raise RuntimeError(
            "Refusing to downgrade because Google Books metadata is not stored locally"
        )

    with op.batch_alter_table("books") as batch_op:
        batch_op.drop_constraint("ck_books_title_nonempty", type_="check")
        batch_op.drop_constraint("ck_books_total_pages_positive", type_="check")
        batch_op.add_column(sa.Column("isbn_13", sa.String(length=13), nullable=True))
        batch_op.add_column(sa.Column("thumbnail_url", sa.Text(), nullable=True))
        batch_op.alter_column(
            "total_pages",
            existing_type=sa.Integer(),
            nullable=False,
        )
        batch_op.alter_column(
            "title",
            existing_type=sa.String(length=255),
            nullable=False,
        )
        batch_op.create_unique_constraint("uq_books_isbn_13", ["isbn_13"])
        batch_op.create_check_constraint(
            "ck_books_title_nonempty",
            "length(trim(title)) > 0",
        )
        batch_op.create_check_constraint(
            "ck_books_total_pages_positive",
            "total_pages >= 1",
        )
