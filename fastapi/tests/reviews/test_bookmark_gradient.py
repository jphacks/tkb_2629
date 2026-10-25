from backend.reviews.application.bookmark_gradient import build_bookmark_gradient_svg


def test_bookmark_gradient_uses_all_colors_and_can_be_tested_deterministically(capsys):
    svg = build_bookmark_gradient_svg(
        ["#ff0000", "#00ff00", "#0000ff"], seed=7
    )

    print(svg)
    captured = capsys.readouterr().out
    assert captured == f"{svg}\n"
    assert svg.startswith('<svg xmlns="http://www.w3.org/2000/svg"')
    assert svg.count("<radialGradient ") == 3
    assert svg.count("<stop ") == 9
    assert 'stop-color="#FF0000"' in svg
    assert 'stop-color="#00FF00"' in svg
    assert 'stop-color="#0000FF"' in svg
    assert 'fill="url(#bookmark-gradient-blob-0)"' in svg
    assert 'gradientUnits="userSpaceOnUse"' in svg


def test_bookmark_gradient_falls_back_when_no_bookmark_has_a_color():
    svg = build_bookmark_gradient_svg([], seed=7)

    assert svg.count("<radialGradient ") == 1
    assert 'stop-color="#8C8C8C"' in svg
