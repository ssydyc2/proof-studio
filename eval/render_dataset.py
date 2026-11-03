#!/usr/bin/env python3
"""Render the ProofNet informal statement cards in eval/dataset."""

import json
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent / "dataset"
BUILD = Path("/tmp/proofstudio-eval-cards")

PREAMBLE = r"""
\documentclass[11pt]{article}
\usepackage[T1]{fontenc}
\usepackage[utf8]{inputenc}
\DeclareUnicodeCharacter{2013}{--}
\DeclareUnicodeCharacter{00E9}{\'{e}}
\DeclareUnicodeCharacter{00F6}{\"o}
\DeclareUnicodeCharacter{00F4}{\^{o}}
\usepackage{lmodern,amsmath,amssymb,mathtools}
\usepackage[margin=0.5in]{geometry}
\usepackage[active,tightpage]{preview}
\setlength{\PreviewBorder}{10pt}
\pagestyle{empty}
\setlength{\parindent}{0pt}
\setlength{\parskip}{0.5em}
\begin{document}
\begin{preview}
\begin{minipage}{5.5in}
"""

END = r"""
\end{minipage}
\end{preview}
\end{document}
"""

REPO = "https://github.com/zhangir-azerbayev/ProofNet/blob/main/benchmark/benchmark_to_publish/informal/"

# Statements are the informal exercises, not the included proofs.
# Book-local notation is spelled out so a screenshot stands on its own.
PROBLEMS = [
    ("putnam-2020-b5", "contest", "Four points on the unit circle", "Putnam", "2020 B5", "Putnam.tex", r"""
For $j \in \{1,2,3,4\}$, let $z_j$ be a complex number with $|z_j| = 1$ and $z_j \neq 1$. Prove that
\[3 - z_1 - z_2 - z_3 - z_4 + z_1 z_2 z_3 z_4 \neq 0.\]
"""),
    ("putnam-2018-a5", "analysis", "A smooth function must dip", "Putnam", "2018 A5", "Putnam.tex", r"""
Let $f \colon \mathbb{R} \to \mathbb{R}$ be infinitely differentiable, with $f(0) = 0$, $f(1) = 1$, and $f(x) \geq 0$ for every $x \in \mathbb{R}$. Show that there exist a positive integer $n$ and a real number $x$ such that $f^{(n)}(x) < 0$.
"""),
    ("putnam-2018-b2", "complex analysis", "A polynomial with no root in the disc", "Putnam", "2018 B2", "Putnam.tex", r"""
Let $n$ be a positive integer, and let
\[f_n(z) = n + (n-1)z + (n-2)z^2 + \cdots + z^{n-1}.\]
Prove that $f_n$ has no roots in the closed unit disc $\{z \in \mathbb{C} : |z| \leq 1\}$.
"""),
    ("putnam-2018-b4", "recurrences", "A zero forces periodicity", "Putnam", "2018 B4", "Putnam.tex", r"""
Given a real number $a$, define a sequence by $x_0 = 1$, $x_1 = x_2 = a$, and $x_{n+1} = 2x_n x_{n-1} - x_{n-2}$ for $n \geq 2$. Prove that if $x_n = 0$ for some $n$, then the sequence is periodic.
"""),
    ("putnam-2017-b3", "power series", "A $0$-$1$ series takes an irrational value", "Putnam", "2017 B3", "Putnam.tex", r"""
Suppose $f(x) = \sum_{i=0}^{\infty} c_i x^i$ is a power series for which each coefficient $c_i$ is $0$ or $1$. Show that if $f(2/3) = 3/2$, then $f(1/2)$ is irrational.
"""),
    ("putnam-2014-a5", "polynomials", "These polynomials are pairwise coprime", "Putnam", "2014 A5", "Putnam.tex", r"""
Let
\[P_n(x) = 1 + 2x + 3x^2 + \cdots + n x^{n-1}.\]
Prove that the polynomials $P_j(x)$ and $P_k(x)$ are relatively prime for all positive integers $j$ and $k$ with $j \neq k$.
"""),
    ("putnam-2000-a2", "number theory", "Three consecutive sums of two squares", "Putnam", "2000 A2", "Putnam.tex", r"""
Prove that there are infinitely many integers $n$ such that $n$, $n+1$, and $n+2$ are each the sum of two squares of integers.
"""),
    ("putnam-1998-b6", "number theory", "A cubic is not always a square", "Putnam", "1998 B6", "Putnam.tex", r"""
Prove that for any integers $a, b, c$ there is a positive integer $n$ such that $\sqrt{n^3 + a n^2 + b n + c}$ is not an integer.
"""),
    ("tripos-primes-3n-plus-2", "number theory", "Infinitely many primes $3n+2$", "Cambridge Tripos", "2022 IA 4-I-1E (a)", "Cambridge-Tripos.tex", r"""
Show that there are infinitely many primes of the form $3n+2$ with $n \in \mathbb{N}$.
"""),
    ("tripos-cube-roots", "number theory", "A sum of cube roots is irrational", "Cambridge Tripos", "2022 IA 4-I-2D (a)", "Cambridge-Tripos.tex", r"""
Show that $\sqrt[3]{2} + \sqrt[3]{3}$ is irrational.
"""),
    ("ireland-rosen-1-30", "number theory", "A partial harmonic sum is never an integer", "Ireland--Rosen", "1.30", "Ireland-Rosen.tex", r"""
Prove that $\frac{1}{2} + \frac{1}{3} + \cdots + \frac{1}{n}$ is not an integer.
"""),
    ("ireland-rosen-3-1", "number theory", "Infinitely many primes congruent to $-1$ modulo $6$", "Ireland--Rosen", "3.1", "Ireland-Rosen.tex", r"""
Show that there are infinitely many primes congruent to $-1$ modulo $6$.
"""),
    ("ireland-rosen-3-4", "number theory", "A quadratic equation with no integer solution", "Ireland--Rosen", "3.4", "Ireland-Rosen.tex", r"""
Show that the equation $3x^2 + 2 = y^2$ has no solution in integers.
"""),
    ("ireland-rosen-3-5", "number theory", "A cubic equation with no integer solution", "Ireland--Rosen", "3.5", "Ireland-Rosen.tex", r"""
Show that the equation $7x^3 + 2 = y^3$ has no solution in integers.
"""),
    ("ireland-rosen-5-13", "number theory", "Prime divisors of $x^4 - x^2 + 1$", "Ireland--Rosen", "5.13", "Ireland-Rosen.tex", r"""
Show that any prime divisor of $x^4 - x^2 + 1$ is congruent to $1$ modulo $12$.
"""),
    ("artin-3-7-2", "linear algebra", "Not a finite union of proper subspaces", "Artin", "3.7.2", "Artin.tex", r"""
Let $V$ be a vector space over an infinite field $F$. Prove that $V$ is not the union of finitely many proper subspaces.
"""),
    ("artin-6-4-2", "group theory", "Groups of order $pq$ are not simple", "Artin", "6.4.2", "Artin.tex", r"""
Prove that no group of order $pq$, where $p$ and $q$ are primes, is simple.
"""),
    ("artin-10-6-7", "algebra", "Ideals in the Gaussian integers", "Artin", "10.6.7", "Artin.tex", r"""
Prove that every nonzero ideal in the ring of Gaussian integers contains a nonzero integer.
"""),
    ("artin-11-13-3", "number theory", "Primes congruent to $-1$ modulo $4$", "Artin", "11.13.3", "Artin.tex", r"""
Prove that there are infinitely many primes congruent to $-1$ modulo $4$.
"""),
    ("artin-13-6-10", "field theory", "A product over a finite field", "Artin", "13.6.10", "Artin.tex", r"""
Let $K$ be a finite field. Prove that the product of the nonzero elements of $K$ is $-1$.
"""),
    ("axler-4-4", "polynomials", "Distinct roots and the derivative", "Axler", "4.4", "Axler.tex", r"""
Suppose $p$ is a polynomial of degree $m$ with complex coefficients. Prove that $p$ has $m$ distinct roots if and only if $p$ and its derivative $p'$ have no root in common.
"""),
    ("axler-5-24", "linear algebra", "Invariant subspaces have even dimension", "Axler", "5.24", "Axler.tex", r"""
Suppose $V$ is a real vector space and $T$ is a linear operator on $V$ with no eigenvalues. Prove that every subspace of $V$ invariant under $T$ has even dimension.
"""),
    ("axler-6-3", "inequalities", "A weighted Cauchy--Schwarz inequality", "Axler", "6.3", "Axler.tex", r"""
Prove that
\[\Bigl(\sum_{j=1}^{n} a_j b_j\Bigr)^2 \leq \Bigl(\sum_{j=1}^{n} j\, a_j^2\Bigr)\Bigl(\sum_{j=1}^{n} \frac{b_j^2}{j}\Bigr)\]
for all real numbers $a_1, \ldots, a_n$ and $b_1, \ldots, b_n$.
"""),
    ("axler-7-10", "linear algebra", "A normal operator that is a projection", "Axler", "7.10", "Axler.tex", r"""
Suppose $V$ is a complex inner-product space and $T$ is a normal operator on $V$ such that $T^9 = T^8$. Prove that $T$ is self-adjoint and $T^2 = T$.
"""),
    ("dummit-foote-1-6-23", "group theory", "An automorphism with one fixed point", "Dummit--Foote", "1.6.23", "Dummit-Foote.tex", r"""
Let $G$ be a finite group and let $\sigma$ be an automorphism of $G$ such that $\sigma(g) = g$ if and only if $g = 1$, and $\sigma^2$ is the identity. Prove that $G$ is abelian.
"""),
    ("dummit-foote-3-2-21a", "group theory", "No proper finite-index subgroup of the rationals", "Dummit--Foote", "3.2.21(a)", "Dummit-Foote.tex", r"""
Prove that $\mathbb{Q}$ has no proper subgroups of finite index.
"""),
    ("dummit-foote-4-5-13", "group theory", "A normal Sylow subgroup in order $56$", "Dummit--Foote", "4.5.13", "Dummit-Foote.tex", r"""
Prove that a group of order $56$ has a normal Sylow $p$-subgroup for some prime $p$ dividing its order.
"""),
    ("dummit-foote-8-3-4", "number theory", "Sums of two rational squares", "Dummit--Foote", "8.3.4", "Dummit-Foote.tex", r"""
Prove that an integer which is a sum of two squares of rational numbers is a sum of two squares of integers.
"""),
    ("dummit-foote-9-1-6", "ring theory", "An ideal that is not principal", "Dummit--Foote", "9.1.6", "Dummit-Foote.tex", r"""
Prove that the ideal $(x, y)$ is not principal in $\mathbb{Q}[x, y]$.
"""),
    ("dummit-foote-9-4-2d", "polynomials", "An irreducible polynomial from a prime", "Dummit--Foote", "9.4.2(d)", "Dummit-Foote.tex", r"""
Let $p$ be an odd prime. Prove that
\[\frac{(x+2)^p - 2^p}{x}\]
is irreducible in $\mathbb{Z}[x]$.
"""),
    ("herstein-2-2-5", "group theory", "Two power laws force commutativity", "Herstein", "2.2.5", "Herstein.tex", r"""
Let $G$ be a group such that $(ab)^3 = a^3 b^3$ and $(ab)^5 = a^5 b^5$ for all $a, b \in G$. Prove that $G$ is abelian.
"""),
    ("herstein-2-5-52", "group theory", "An automorphism inverting most elements", "Herstein", "2.5.52", "Herstein.tex", r"""
Let $G$ be a finite group and let $\varphi$ be an automorphism of $G$ such that $\varphi(x) = x^{-1}$ for more than three-fourths of the elements of $G$. Prove that $\varphi(y) = y^{-1}$ for all $y \in G$, and hence that $G$ is abelian.
"""),
    ("herstein-4-2-5", "ring theory", "A ring in which every element is a cube root of itself", "Herstein", "4.2.5", "Herstein.tex", r"""
Let $R$ be a ring such that $x^3 = x$ for every $x \in R$. Prove that $R$ is commutative.
"""),
    ("herstein-4-6-3", "polynomials", "Infinitely many irreducible specializations", "Herstein", "4.6.3", "Herstein.tex", r"""
Show that there are infinitely many integers $a$ such that $x^7 + 15x^2 - 30x + a$ is irreducible in $\mathbb{Q}[x]$.
"""),
    ("munkres-23-9", "topology", "A product minus a rectangle stays connected", "Munkres", "23.9", "Munkres.tex", r"""
Let $X$ and $Y$ be connected spaces, and let $A$ be a proper subset of $X$ and $B$ a proper subset of $Y$. Prove that $(X \times Y) \setminus (A \times B)$ is connected.
"""),
    ("munkres-24-2", "topology", "A real function on the circle", "Munkres", "24.2", "Munkres.tex", r"""
Let $f \colon S^1 \to \mathbb{R}$ be continuous, where $S^1$ is the unit circle in $\mathbb{R}^2$. Prove that there is a point $x \in S^1$ with $f(x) = f(-x)$.
"""),
    ("munkres-27-4", "topology", "A connected metric space is uncountable", "Munkres", "27.4", "Munkres.tex", r"""
Prove that a connected metric space with at least two points is uncountable.
"""),
    ("munkres-26-12", "topology", "Perfect maps reflect compactness", "Munkres", "26.12", "Munkres.tex", r"""
A continuous surjection $f \colon X \to Y$ is perfect if it is closed and every fiber $f^{-1}(y)$ is compact. Prove that if $f$ is perfect and $Y$ is compact, then $X$ is compact.
"""),
    ("munkres-18-13", "topology", "Continuous extensions to the closure", "Munkres", "18.13", "Munkres.tex", r"""
Let $A \subset X$, let $f \colon A \to Y$ be continuous, and let $Y$ be Hausdorff. Show that if $f$ extends to a continuous function $g \colon \overline{A} \to Y$, then $g$ is uniquely determined by $f$.
"""),
    ("pugh-2-46", "metric spaces", "Distance between two compact sets", "Pugh", "2.46", "Pugh.tex", r"""
Let $M$ be a metric space. Assume that $A$ and $B$ are compact, disjoint, nonempty subsets of $M$. Prove that there are $a_0 \in A$ and $b_0 \in B$ such that $d(a_0, b_0) \leq d(a, b)$ for all $a \in A$ and $b \in B$.
"""),
    ("pugh-2-41", "metric spaces", "The closed unit ball of any norm", "Pugh", "2.41", "Pugh.tex", r"""
Let $\|\cdot\|$ be any norm on $\mathbb{R}^m$, and let $B = \{x \in \mathbb{R}^m : \|x\| \leq 1\}$. Prove that $B$ is compact.
"""),
    ("pugh-3-1", "analysis", "A squared Lipschitz condition", "Pugh", "3.1", "Pugh.tex", r"""
Suppose $f \colon \mathbb{R} \to \mathbb{R}$ satisfies $|f(t) - f(x)| \leq |t - x|^2$ for all real $t$ and $x$. Prove that $f$ is constant.
"""),
    ("rudin-3-7", "series", "Square roots over $n$", "Rudin", "3.7", "Rudin.tex", r"""
Prove that if $\sum a_n$ converges and $a_n \geq 0$ for every $n$, then $\sum \sqrt{a_n}/n$ converges.
"""),
    ("rudin-3-8", "series", "A monotonic factor preserves convergence", "Rudin", "3.8", "Rudin.tex", r"""
If $\sum a_n$ converges, and if $\{b_n\}$ is monotonic and bounded, prove that $\sum a_n b_n$ converges.
"""),
    ("rudin-4-15", "analysis", "A continuous open map of the line", "Rudin", "4.15", "Rudin.tex", r"""
Prove that every continuous open mapping of $\mathbb{R}$ into $\mathbb{R}$ is monotonic.
"""),
    ("rudin-5-4", "calculus", "A polynomial with a root in $(0,1)$", "Rudin", "5.4", "Rudin.tex", r"""
If
\[C_0 + \frac{C_1}{2} + \cdots + \frac{C_{n-1}}{n} + \frac{C_n}{n+1} = 0,\]
where $C_0, \ldots, C_n$ are real constants, prove that the equation
\[C_0 + C_1 x + \cdots + C_{n-1} x^{n-1} + C_n x^n = 0\]
has at least one real root between $0$ and $1$.
"""),
    ("rudin-5-17", "calculus", "A lower bound on the third derivative", "Rudin", "5.17", "Rudin.tex", r"""
Suppose $f$ is three times differentiable on $[-1, 1]$, with $f(-1) = f(0) = 0$, $f(1) = 1$, and $f'(0) = 0$. Prove that $f'''(x) \geq 3$ for some $x \in (-1, 1)$.
"""),
    ("shakarchi-3-14", "complex analysis", "Injective entire functions are linear", "Stein--Shakarchi", "3.14", "Shakarchi.tex", r"""
Prove that all entire functions that are also injective take the form $f(z) = az + b$ with $a, b \in \mathbb{C}$ and $a \neq 0$.
"""),
    ("shakarchi-3-22", "complex analysis", "No holomorphic extension of $1/z$", "Stein--Shakarchi", "3.22", "Shakarchi.tex", r"""
Show that there is no holomorphic function $f$ on the open unit disc that extends continuously to the boundary and satisfies $f(z) = 1/z$ for $z$ on the unit circle.
"""),
    ("shakarchi-5-1", "complex analysis", "Zeros of a bounded holomorphic function", "Stein--Shakarchi", "5.1", "Shakarchi.tex", r"""
Prove that if $f$ is holomorphic in the unit disc, bounded and not identically zero, and $z_1, z_2, \ldots$ are its zeros in the disc, then $\sum_n (1 - |z_n|) < \infty$.
"""),
]

def card(title, field, body):
    return (
        PREAMBLE
        + "{\\large\\bfseries "
        + title
        + "\\par}\n{\\small "
        + field
        + "\\par}\n"
        + body.strip()
        + "\n"
        + END
    )


def render(folder, title, field, body):
    work = BUILD / folder
    if work.exists():
        shutil.rmtree(work)
    work.mkdir(parents=True)
    (work / "card.tex").write_text(card(title, field, body), encoding="utf-8")
    subprocess.run(
        ["pdflatex", "-interaction=nonstopmode", "-halt-on-error", "card.tex"],
        cwd=work,
        check=True,
        stdout=subprocess.DEVNULL,
    )
    subprocess.run(
        [
            "gs",
            "-q",
            "-dSAFER",
            "-dBATCH",
            "-dNOPAUSE",
            "-sDEVICE=png16m",
            "-r216",
            "-sOutputFile=source.png",
            "card.pdf",
        ],
        cwd=work,
        check=True,
        stdout=subprocess.DEVNULL,
    )
    return work / "source.png"


def main():
    if len(PROBLEMS) != 50:
        raise SystemExit(f"expected 50 problems, got {len(PROBLEMS)}")
    if ROOT.exists():
        shutil.rmtree(ROOT)
    ROOT.mkdir(parents=True)
    manifest = []
    for index, (slug, field, title, source, exercise, filename, body) in enumerate(PROBLEMS, start=1):
        folder = f"{index:02d}-{slug}"
        dest = ROOT / folder
        dest.mkdir(parents=True)
        url = REPO + filename
        meta = {
            "title": title,
            "field": field,
            "source": source.replace("--", "–"),
            "exercise": exercise,
            "url": url,
        }
        (dest / "meta.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        png = render(folder, title, f"{source}, {exercise}", body)
        shutil.copyfile(png, dest / "source.png")
        manifest.append({"folder": folder, **meta})
        print(f"{folder}  {title}")
    (ROOT / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
