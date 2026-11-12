import type { BankExercise } from "./types";

// Banque d'exercices 1BAC Sciences (maths) pour les devoirs proposés. Généré, ne pas modifier à la main.
export const MATH_1BAC_BANK: BankExercise[] = [
 {
  "id": "log-1",
  "chapter": "1bac-math-1",
  "title": "Propositions, quantificateurs et négations",
  "questions": [
   {
    "q": "Donner la valeur de vérité de chaque proposition en justifiant : $P$ : « $\\forall x\\in\\mathbb R,\\ x^2+1\\gt0$ » ; $Q$ : « $\\exists n\\in\\mathbb N,\\ n^2=7$ » ; $R$ : « $\\forall x\\in\\mathbb R,\\ x^2\\ge x$ ».",
    "w": 2,
    "s": "$P$ est <b>vraie</b> : pour tout réel $x$, $x^2\\ge0$ donc $x^2+1\\ge1\\gt0$.<br>$Q$ est <b>fausse</b> : $2^2=4\\lt7\\lt9=3^2$, donc aucun entier naturel n'a pour carré $7$.<br>$R$ est <b>fausse</b> : un contre-exemple suffit. Pour $x=\\tfrac12$ : $x^2=\\tfrac14\\lt\\tfrac12=x$."
   },
   {
    "q": "Écrire la négation de chacune des propositions $P$, $Q$ et $R$.",
    "w": 2,
    "s": "On remplace $\\forall$ par $\\exists$ (et inversement) et on nie la fin :<br>$\\overline P$ : « $\\exists x\\in\\mathbb R,\\ x^2+1\\le0$ » ;<br>$\\overline Q$ : « $\\forall n\\in\\mathbb N,\\ n^2\\ne7$ » ;<br>$\\overline R$ : « $\\exists x\\in\\mathbb R,\\ x^2\\lt x$ »."
   },
   {
    "q": "Déterminer la valeur de vérité de $P\\Rightarrow Q$, de $Q\\Rightarrow R$ et de $P\\ \\text{ou}\\ Q$.",
    "w": 2,
    "s": "Une implication est fausse seulement quand la première proposition est vraie et la seconde fausse.<br>$P\\Rightarrow Q$ : $P$ vraie et $Q$ fausse, donc <b>fausse</b>.<br>$Q\\Rightarrow R$ : $Q$ est fausse, donc l'implication est <b>vraie</b>.<br>$P$ ou $Q$ : il suffit qu'une des deux soit vraie ; $P$ est vraie, donc <b>vraie</b>."
   }
  ]
 },
 {
  "id": "log-2",
  "chapter": "1bac-math-1",
  "title": "Raisonnement par contraposée",
  "questions": [
   {
    "q": "Soit $n\\in\\mathbb N$. Montrer par contraposée que : si $n^2$ est pair, alors $n$ est pair.",
    "w": 3,
    "s": "La contraposée de « $n^2$ pair $\\Rightarrow$ $n$ pair » est « $n$ impair $\\Rightarrow$ $n^2$ impair ».<br>Si $n$ est impair, il s'écrit $n=2k+1$ avec $k\\in\\mathbb N$. Alors $n^2=4k^2+4k+1=2(2k^2+2k)+1$ : c'est un entier impair.<br>La contraposée est vraie, donc l'implication de départ est vraie."
   },
   {
    "q": "Soient $x$ et $y$ deux réels de $]1;+\\infty[$. Montrer que : si $x\\ne y$, alors $x^2-2x\\ne y^2-2y$.",
    "w": 4,
    "s": "On montre la contraposée : si $x^2-2x=y^2-2y$, alors $x=y$.<br>$x^2-2x=y^2-2y\\iff x^2-y^2-2(x-y)=0\\iff(x-y)(x+y)-2(x-y)=0\\iff(x-y)(x+y-2)=0$.<br>Comme $x\\gt1$ et $y\\gt1$, on a $x+y\\gt2$, donc $x+y-2\\ne0$. Il reste $x-y=0$, c'est-à-dire $x=y$.<br>La contraposée est démontrée, donc la proposition est vraie."
   }
  ]
 },
 {
  "id": "log-3",
  "chapter": "1bac-math-1",
  "title": "Raisonnement par l'absurde",
  "questions": [
   {
    "q": "Montrer par l'absurde que $\\sqrt2\\notin\\mathbb Q$. (On admet que si $p^2$ est pair, alors $p$ est pair.)",
    "w": 3,
    "s": "Supposons $\\sqrt2=\\dfrac pq$ avec $p,q$ entiers naturels non nuls et la fraction irréductible.<br>Alors $p^2=2q^2$ : $p^2$ est pair, donc $p$ est pair, $p=2k$.<br>On obtient $4k^2=2q^2$, soit $q^2=2k^2$ : $q^2$ est pair, donc $q$ est pair.<br>$p$ et $q$ sont tous les deux pairs : la fraction n'est pas irréductible. C'est une contradiction, donc $\\sqrt2\\notin\\mathbb Q$."
   },
   {
    "q": "Soit $n\\in\\mathbb N^*$. Montrer par l'absurde que $\\sqrt{n^2+1}$ n'est pas un entier.",
    "w": 3,
    "s": "Supposons que $\\sqrt{n^2+1}=m$ avec $m\\in\\mathbb N$.<br>On a $n^2\\lt n^2+1\\lt n^2+2n+1=(n+1)^2$ car $2n\\gt0$. Donc $n^2\\lt m^2\\lt(n+1)^2$, puis $n\\lt m\\lt n+1$.<br>Or il n'existe aucun entier strictement compris entre deux entiers consécutifs : contradiction. Donc $\\sqrt{n^2+1}\\notin\\mathbb N$."
   },
   {
    "q": "Montrer par l'absurde que pour tout réel $x\\ne-2$ : $\\dfrac{x+1}{x+2}\\ne1$.",
    "w": 2,
    "s": "Supposons $\\dfrac{x+1}{x+2}=1$ pour un réel $x\\ne-2$. Alors $x+1=x+2$, soit $1=2$ : c'est absurde. Donc $\\dfrac{x+1}{x+2}\\ne1$."
   }
  ]
 },
 {
  "id": "log-4",
  "chapter": "1bac-math-1",
  "title": "Raisonnement par récurrence",
  "questions": [
   {
    "q": "Montrer par récurrence que pour tout $n\\in\\mathbb N^*$ : $1+3+5+\\cdots+(2n-1)=n^2$.",
    "w": 4,
    "s": "<b>Initialisation</b> : pour $n=1$, le membre de gauche vaut $1$ et $1^2=1$. La propriété est vraie.<br><b>Hérédité</b> : supposons $1+3+\\cdots+(2n-1)=n^2$ pour un $n\\ge1$. Alors $1+3+\\cdots+(2n-1)+(2n+1)=n^2+2n+1=(n+1)^2$ : la propriété est vraie au rang $n+1$.<br><b>Conclusion</b> : elle est vraie pour tout $n\\in\\mathbb N^*$."
   },
   {
    "q": "Montrer par récurrence que pour tout $n\\in\\mathbb N$, $4^n-1$ est divisible par $3$.",
    "w": 4,
    "s": "<b>Initialisation</b> : $4^0-1=0=3\\times0$, divisible par $3$.<br><b>Hérédité</b> : supposons $4^n-1=3k$ avec $k\\in\\mathbb N$. Alors $4^{n+1}-1=4\\times4^n-1=4(3k+1)-1=12k+3=3(4k+1)$ : divisible par $3$.<br><b>Conclusion</b> : pour tout $n\\in\\mathbb N$, $3$ divise $4^n-1$."
   }
  ]
 },
 {
  "id": "log-5",
  "chapter": "1bac-math-1",
  "title": "Raisonnement par disjonction des cas",
  "questions": [
   {
    "q": "Montrer que pour tout $n\\in\\mathbb N$, l'entier $n^2+n$ est pair.",
    "w": 3,
    "s": "$n^2+n=n(n+1)$. On distingue deux cas.<br>Si $n$ est pair, $n=2k$ et $n(n+1)=2k(2k+1)$ est pair.<br>Si $n$ est impair, $n=2k+1$ et $n(n+1)=(2k+1)(2k+2)=2(2k+1)(k+1)$ est pair.<br>Dans tous les cas, $n^2+n$ est pair."
   },
   {
    "q": "Résoudre dans $\\mathbb R$ l'équation $|x-1|+|x+2|=5$.",
    "w": 4,
    "s": "On étudie le signe de $x-1$ et de $x+2$ ; les valeurs charnières sont $-2$ et $1$.<br><b>Cas $x\\lt-2$</b> : $-(x-1)-(x+2)=-2x-1=5$, donc $x=-3$, qui convient ($-3\\lt-2$).<br><b>Cas $-2\\le x\\le1$</b> : $-(x-1)+(x+2)=3=5$ : impossible.<br><b>Cas $x\\gt1$</b> : $(x-1)+(x+2)=2x+1=5$, donc $x=2$, qui convient.<br>$S=\\{-3;2\\}$."
   },
   {
    "q": "En déduire que pour tout réel $x$ : $|x-1|+|x+2|\\ge3$.",
    "w": 2,
    "s": "D'après les calculs précédents : si $x\\lt-2$, la somme vaut $-2x-1\\gt3$ ; si $-2\\le x\\le1$, elle vaut $3$ ; si $x\\gt1$, elle vaut $2x+1\\gt3$. Dans tous les cas elle est supérieure ou égale à $3$."
   }
  ]
 },
 {
  "id": "log-6",
  "chapter": "1bac-math-1",
  "title": "Implications et équivalences",
  "questions": [
   {
    "q": "L'équivalence « $x^2=4\\iff x=2$ » est-elle vraie pour tout réel $x$ ? Justifier.",
    "w": 2,
    "s": "Non. L'implication $x=2\\Rightarrow x^2=4$ est vraie, mais la réciproque est fausse : pour $x=-2$, on a $x^2=4$ et $x\\ne2$. La bonne équivalence est $x^2=4\\iff(x=2\\ \\text{ou}\\ x=-2)$."
   },
   {
    "q": "Montrer que pour tout réel $x\\gt0$ : $x+\\dfrac1x\\ge2$, puis préciser le cas d'égalité.",
    "w": 3,
    "s": "Pour $x\\gt0$ : $x+\\dfrac1x-2=\\dfrac{x^2-2x+1}x=\\dfrac{(x-1)^2}x$.<br>Un carré est positif et $x\\gt0$, donc $\\dfrac{(x-1)^2}x\\ge0$, c'est-à-dire $x+\\dfrac1x\\ge2$.<br>Égalité $\\iff(x-1)^2=0\\iff x=1$."
   },
   {
    "q": "Montrer que : $x\\in[1;2]\\Rightarrow\\dfrac1x\\in\\left[\\tfrac12;1\\right]$. La réciproque est-elle vraie pour $x\\gt0$ ?",
    "w": 3,
    "s": "Si $1\\le x\\le2$, comme la fonction inverse est décroissante sur $]0;+\\infty[$, on obtient $\\dfrac12\\le\\dfrac1x\\le1$.<br>Réciproque : si $x\\gt0$ et $\\dfrac12\\le\\dfrac1x\\le1$, on applique encore la fonction inverse (décroissante) : $1\\le x\\le2$. Pour $x\\gt0$, la réciproque est donc vraie : c'est une équivalence."
   }
  ]
 },
 {
  "id": "gen-1",
  "chapter": "1bac-math-2",
  "title": "Ensemble de définition et parité",
  "questions": [
   {
    "q": "Déterminer l'ensemble de définition de $f(x)=\\dfrac{x}{x^2-4}$ et étudier sa parité.",
    "w": 2,
    "s": "$f(x)$ existe si $x^2-4\\ne0$, soit $x\\ne2$ et $x\\ne-2$ : $D_f=\\mathbb R\\setminus\\{-2;2\\}$.<br>$D_f$ est symétrique par rapport à $0$ et pour $x\\in D_f$ : $f(-x)=\\dfrac{-x}{(-x)^2-4}=-\\dfrac{x}{x^2-4}=-f(x)$. $f$ est <b>impaire</b>."
   },
   {
    "q": "Même question pour $g(x)=\\sqrt{4-x^2}$.",
    "w": 2,
    "s": "$g(x)$ existe si $4-x^2\\ge0$, soit $x^2\\le4$, c'est-à-dire $-2\\le x\\le2$ : $D_g=[-2;2]$, symétrique par rapport à $0$.<br>$g(-x)=\\sqrt{4-(-x)^2}=\\sqrt{4-x^2}=g(x)$ : $g$ est <b>paire</b>."
   },
   {
    "q": "Montrer que $h(x)=x^2+x$ n'est ni paire ni impaire.",
    "w": 2,
    "s": "Un contre-exemple suffit : $h(1)=2$ et $h(-1)=0$.<br>$h(-1)\\ne h(1)$ : $h$ n'est pas paire. $h(-1)\\ne-h(1)=-2$ : $h$ n'est pas impaire."
   }
  ]
 },
 {
  "id": "gen-2",
  "chapter": "1bac-math-2",
  "title": "Fonction majorée, minorée, extremums",
  "questions": [
   {
    "q": "Soit $f(x)=\\dfrac{2x}{x^2+1}$ définie sur $\\mathbb R$. Montrer que $f(x)\\le1$ pour tout réel $x$.",
    "w": 3,
    "s": "$f(x)-1=\\dfrac{2x-(x^2+1)}{x^2+1}=\\dfrac{-(x-1)^2}{x^2+1}$.<br>Le numérateur est négatif (opposé d'un carré) et le dénominateur strictement positif, donc $f(x)-1\\le0$, soit $f(x)\\le1$ : $f$ est majorée par $1$."
   },
   {
    "q": "Montrer que $f(x)\\ge-1$ pour tout réel $x$.",
    "w": 3,
    "s": "$f(x)+1=\\dfrac{2x+x^2+1}{x^2+1}=\\dfrac{(x+1)^2}{x^2+1}\\ge0$, donc $f(x)\\ge-1$ : $f$ est minorée par $-1$."
   },
   {
    "q": "En déduire le maximum et le minimum de $f$ sur $\\mathbb R$.",
    "w": 2,
    "s": "$f(1)=\\dfrac22=1$ : le majorant $1$ est atteint, c'est le <b>maximum</b> de $f$ (atteint en $1$).<br>$f(-1)=-1$ : c'est le <b>minimum</b> de $f$ (atteint en $-1$)."
   }
  ]
 },
 {
  "id": "gen-3",
  "chapter": "1bac-math-2",
  "title": "Variations par le taux d'accroissement",
  "questions": [
   {
    "q": "Soit $f(x)=x^2-4x+1$. Calculer, pour $x\\ne y$, le taux $T=\\dfrac{f(x)-f(y)}{x-y}$, puis en déduire les variations de $f$ sur $]-\\infty;2]$ et sur $[2;+\\infty[$.",
    "w": 4,
    "s": "$f(x)-f(y)=x^2-y^2-4(x-y)=(x-y)(x+y-4)$, donc $T=x+y-4$.<br>Si $x,y\\in]-\\infty;2]$ avec $x\\ne y$ : $x+y\\lt4$, donc $T\\lt0$ : $f$ est <b>strictement décroissante</b> sur $]-\\infty;2]$.<br>Si $x,y\\in[2;+\\infty[$ avec $x\\ne y$ : $x+y\\gt4$, $T\\gt0$ : $f$ est <b>strictement croissante</b> sur $[2;+\\infty[$."
   },
   {
    "q": "Dresser le tableau de variations de $f$ et donner son minimum.",
    "w": 2,
    "s": "<table class='tv'><tr><td>$x$</td><td>$-\\infty$</td><td></td><td>$2$</td><td></td><td>$+\\infty$</td></tr><tr><td>$f$</td><td></td><td>↘</td><td>$-3$</td><td>↗</td><td></td></tr></table>$f(2)=4-8+1=-3$ : le minimum de $f$ est $-3$, atteint en $2$."
   },
   {
    "q": "Soit $g(x)=\\dfrac{2x-1}{x+1}$. Montrer que $g$ est strictement croissante sur $]-1;+\\infty[$.",
    "w": 3,
    "s": "Pour $x\\ne y$ dans $]-1;+\\infty[$ : $g(x)-g(y)=\\dfrac{(2x-1)(y+1)-(2y-1)(x+1)}{(x+1)(y+1)}=\\dfrac{3(x-y)}{(x+1)(y+1)}$.<br>Donc $T=\\dfrac{3}{(x+1)(y+1)}$. Comme $x+1\\gt0$ et $y+1\\gt0$, $T\\gt0$ : $g$ est strictement croissante sur $]-1;+\\infty[$."
   }
  ]
 },
 {
  "id": "gen-4",
  "chapter": "1bac-math-2",
  "title": "Composée de deux fonctions",
  "questions": [
   {
    "q": "Soient $u(x)=x^2-2x$ et $v(x)=\\sqrt x$. Déterminer l'ensemble de définition de $h=v\\circ u$, c'est-à-dire $h(x)=\\sqrt{x^2-2x}$.",
    "w": 3,
    "s": "$h(x)$ existe si $x^2-2x\\ge0$, soit $x(x-2)\\ge0$.<br>Tableau de signes : le produit est positif à l'extérieur des racines $0$ et $2$.<br>$D_h=]-\\infty;0]\\cup[2;+\\infty[$."
   },
   {
    "q": "Étudier les variations de $u$ sur $[1;+\\infty[$, puis en déduire celles de $h$ sur $[2;+\\infty[$.",
    "w": 3,
    "s": "$u(x)=(x-1)^2-1$ : $u$ est strictement croissante sur $[1;+\\infty[$ (le carré d'un nombre positif croissant).<br>Sur $[2;+\\infty[$, $u$ est croissante et prend des valeurs positives ; $v=\\sqrt{\\ }$ est croissante sur $[0;+\\infty[$.<br>La composée de deux fonctions croissantes est croissante : $h$ est <b>strictement croissante</b> sur $[2;+\\infty[$."
   },
   {
    "q": "Calculer $h(2)$ et $h(4)$, puis encadrer $h(x)$ pour $x\\in[2;4]$.",
    "w": 2,
    "s": "$h(2)=\\sqrt{4-4}=0$ et $h(4)=\\sqrt{16-8}=\\sqrt8=2\\sqrt2$.<br>$h$ est croissante sur $[2;4]$, donc pour $x\\in[2;4]$ : $0\\le h(x)\\le2\\sqrt2$."
   }
  ]
 },
 {
  "id": "gen-5",
  "chapter": "1bac-math-2",
  "title": "Position relative de deux courbes",
  "questions": [
   {
    "q": "Soient $f(x)=x^2$ et $g(x)=2x+3$. Étudier le signe de $f(x)-g(x)$.",
    "w": 3,
    "s": "$f(x)-g(x)=x^2-2x-3=(x-3)(x+1)$ (on vérifie en développant).<br>Ce trinôme est positif à l'extérieur des racines $-1$ et $3$ et négatif entre elles :<br>$f(x)-g(x)\\gt0$ sur $]-\\infty;-1[\\cup]3;+\\infty[$ ; $f(x)-g(x)\\lt0$ sur $]-1;3[$ ; nul en $-1$ et $3$."
   },
   {
    "q": "En déduire la position relative des courbes $(C_f)$ et $(C_g)$ et leurs points d'intersection.",
    "w": 3,
    "s": "Sur $]-\\infty;-1[\\cup]3;+\\infty[$, $(C_f)$ est <b>au-dessus</b> de $(C_g)$ ; sur $]-1;3[$, elle est <b>au-dessous</b>.<br>Points d'intersection : $x=-1$, $y=g(-1)=1$ et $x=3$, $y=g(3)=9$, soit $A(-1;1)$ et $B(3;9)$."
   },
   {
    "q": "Résoudre l'inéquation $x^2\\le2x+3$.",
    "w": 2,
    "s": "$x^2\\le2x+3\\iff f(x)-g(x)\\le0\\iff x\\in[-1;3]$. $S=[-1;3]$."
   }
  ]
 },
 {
  "id": "gen-6",
  "chapter": "1bac-math-2",
  "title": "Fonctions de référence et image d'un intervalle",
  "questions": [
   {
    "q": "Soit $f(x)=\\sqrt{x-1}+2$ définie sur $[1;+\\infty[$. Montrer que $f$ est strictement croissante et dresser son tableau de variations.",
    "w": 3,
    "s": "Si $1\\le x\\lt y$, alors $0\\le x-1\\lt y-1$, puis $\\sqrt{x-1}\\lt\\sqrt{y-1}$ (la racine carrée est croissante), donc $f(x)\\lt f(y)$.<br>$f$ est strictement croissante sur $[1;+\\infty[$, avec $f(1)=2$ (minimum)."
   },
   {
    "q": "Déterminer l'image de l'intervalle $[1;5]$ par $f$.",
    "w": 2,
    "s": "$f$ est croissante : $f([1;5])=[f(1);f(5)]=[2;\\sqrt4+2]=[2;4]$."
   },
   {
    "q": "Soit $g(x)=\\cos(2x)$. Montrer que $g$ est paire et périodique de période $\\pi$.",
    "w": 3,
    "s": "$D_g=\\mathbb R$ est symétrique et $g(-x)=\\cos(-2x)=\\cos(2x)=g(x)$ : $g$ est paire.<br>$g(x+\\pi)=\\cos(2x+2\\pi)=\\cos(2x)=g(x)$ : $g$ est périodique de période $\\pi$."
   }
  ]
 },
 {
  "id": "sui-1",
  "chapter": "1bac-math-3",
  "title": "Suite auxiliaire géométrique",
  "questions": [
   {
    "q": "Soit $(u_n)$ définie par $u_0=2$ et $u_{n+1}=3u_n-2$. Calculer $u_1$, $u_2$ et $u_3$.",
    "w": 1,
    "s": "$u_1=3\\times2-2=4$ ; $u_2=3\\times4-2=10$ ; $u_3=3\\times10-2=28$."
   },
   {
    "q": "On pose $v_n=u_n-1$. Montrer que $(v_n)$ est géométrique ; préciser sa raison et son premier terme.",
    "w": 3,
    "s": "$v_{n+1}=u_{n+1}-1=3u_n-3=3(u_n-1)=3v_n$.<br>$(v_n)$ est géométrique de raison $q=3$ et de premier terme $v_0=u_0-1=1$."
   },
   {
    "q": "Exprimer $v_n$ puis $u_n$ en fonction de $n$.",
    "w": 2,
    "s": "$v_n=v_0\\,q^n=3^n$, donc $u_n=v_n+1=3^n+1$. (Vérification : $u_3=27+1=28$.)"
   },
   {
    "q": "Calculer $S=v_0+v_1+\\cdots+v_5$.",
    "w": 2,
    "s": "Somme de termes consécutifs d'une suite géométrique de raison $3\\ne1$ : $S=v_0\\times\\dfrac{1-3^6}{1-3}=\\dfrac{1-729}{-2}=364$."
   }
  ]
 },
 {
  "id": "sui-2",
  "chapter": "1bac-math-3",
  "title": "Suite arithmétique",
  "questions": [
   {
    "q": "$(u_n)$ est une suite arithmétique telle que $u_3=7$ et $u_{10}=28$. Déterminer sa raison $r$ et son premier terme $u_0$.",
    "w": 3,
    "s": "$u_{10}=u_3+7r$, donc $28=7+7r$, soit $r=3$.<br>$u_3=u_0+3r$, donc $u_0=7-9=-2$."
   },
   {
    "q": "Exprimer $u_n$ en fonction de $n$. Le nombre $100$ est-il un terme de la suite ?",
    "w": 2,
    "s": "$u_n=u_0+nr=3n-2$.<br>$3n-2=100\\iff n=34$ : oui, $u_{34}=100$."
   },
   {
    "q": "Calculer $S=u_0+u_1+\\cdots+u_{20}$.",
    "w": 3,
    "s": "La somme compte $21$ termes : $S=21\\times\\dfrac{u_0+u_{20}}2=21\\times\\dfrac{-2+58}2=21\\times28=588$."
   }
  ]
 },
 {
  "id": "sui-3",
  "chapter": "1bac-math-3",
  "title": "Suite récurrente : bornes et monotonie",
  "questions": [
   {
    "q": "Soit $u_0=1$ et $u_{n+1}=\\sqrt{u_n+2}$. Montrer par récurrence que pour tout $n$ : $0\\lt u_n\\lt2$.",
    "w": 4,
    "s": "<b>Initialisation</b> : $u_0=1$ et $0\\lt1\\lt2$.<br><b>Hérédité</b> : si $0\\lt u_n\\lt2$, alors $2\\lt u_n+2\\lt4$, puis $\\sqrt2\\lt\\sqrt{u_n+2}\\lt2$ (racine croissante). Donc $0\\lt u_{n+1}\\lt2$.<br><b>Conclusion</b> : pour tout $n\\in\\mathbb N$, $0\\lt u_n\\lt2$."
   },
   {
    "q": "Montrer que $u_{n+1}-u_n=\\dfrac{(2-u_n)(u_n+1)}{\\sqrt{u_n+2}+u_n}$, puis en déduire que $(u_n)$ est strictement croissante.",
    "w": 4,
    "s": "On multiplie par la quantité conjuguée : $u_{n+1}-u_n=\\sqrt{u_n+2}-u_n=\\dfrac{u_n+2-u_n^2}{\\sqrt{u_n+2}+u_n}$.<br>Or $-u_n^2+u_n+2=(2-u_n)(u_n+1)$ (on développe pour vérifier).<br>Comme $0\\lt u_n\\lt2$ : $2-u_n\\gt0$, $u_n+1\\gt0$ et le dénominateur est positif. Donc $u_{n+1}-u_n\\gt0$ : la suite est strictement croissante."
   }
  ]
 },
 {
  "id": "sui-4",
  "chapter": "1bac-math-3",
  "title": "Monotonie d'une suite explicite",
  "questions": [
   {
    "q": "Soit $u_n=\\dfrac{2n+1}{n+1}$ pour $n\\in\\mathbb N$. Calculer $u_{n+1}-u_n$ et en déduire le sens de variation de $(u_n)$.",
    "w": 3,
    "s": "$u_{n+1}-u_n=\\dfrac{2n+3}{n+2}-\\dfrac{2n+1}{n+1}=\\dfrac{(2n+3)(n+1)-(2n+1)(n+2)}{(n+1)(n+2)}=\\dfrac{1}{(n+1)(n+2)}$.<br>Ce nombre est strictement positif : $(u_n)$ est <b>strictement croissante</b>."
   },
   {
    "q": "Montrer que pour tout $n$ : $1\\le u_n\\lt2$.",
    "w": 3,
    "s": "$u_n=2-\\dfrac{1}{n+1}$. Comme $\\dfrac1{n+1}\\gt0$, $u_n\\lt2$ : la suite est majorée par $2$.<br>La suite est croissante donc $u_n\\ge u_0=1$ : elle est minorée par $1$."
   },
   {
    "q": "Déterminer le plus petit entier $n$ tel que $u_n\\gt1{,}99$.",
    "w": 2,
    "s": "$u_n\\gt1{,}99\\iff\\dfrac1{n+1}\\lt0{,}01\\iff n+1\\gt100\\iff n\\gt99$. Le plus petit entier est $n=100$."
   }
  ]
 },
 {
  "id": "sui-5",
  "chapter": "1bac-math-3",
  "title": "Suite homographique et suite arithmétique auxiliaire",
  "questions": [
   {
    "q": "Soit $u_0=1$ et $u_{n+1}=\\dfrac{u_n}{1+u_n}$. Calculer $u_1$ et $u_2$.",
    "w": 1,
    "s": "$u_1=\\dfrac{1}{2}$ ; $u_2=\\dfrac{1/2}{3/2}=\\dfrac13$."
   },
   {
    "q": "Montrer par récurrence que $u_n\\gt0$ pour tout $n$.",
    "w": 2,
    "s": "$u_0=1\\gt0$. Si $u_n\\gt0$, alors $1+u_n\\gt0$ et $u_{n+1}=\\dfrac{u_n}{1+u_n}\\gt0$. Donc $u_n\\gt0$ pour tout $n$."
   },
   {
    "q": "On pose $v_n=\\dfrac1{u_n}$. Montrer que $(v_n)$ est arithmétique de raison $1$.",
    "w": 3,
    "s": "$v_{n+1}=\\dfrac{1+u_n}{u_n}=\\dfrac1{u_n}+1=v_n+1$ : $(v_n)$ est arithmétique de raison $1$ et de premier terme $v_0=1$."
   },
   {
    "q": "En déduire $u_n$ en fonction de $n$ et le sens de variation de $(u_n)$.",
    "w": 2,
    "s": "$v_n=1+n$, donc $u_n=\\dfrac1{n+1}$. Comme $n+1$ augmente, $\\dfrac{1}{n+1}$ diminue : $(u_n)$ est strictement décroissante."
   }
  ]
 },
 {
  "id": "sui-6",
  "chapter": "1bac-math-3",
  "title": "Suite géométrique et somme",
  "questions": [
   {
    "q": "$(u_n)$ est géométrique de premier terme $u_0=3$ et de raison $q=\\dfrac12$. Exprimer $u_n$ en fonction de $n$ et calculer $u_4$.",
    "w": 2,
    "s": "$u_n=u_0q^n=3\\left(\\dfrac12\\right)^n$ ; $u_4=\\dfrac3{16}$."
   },
   {
    "q": "Montrer que $S_n=u_0+u_1+\\cdots+u_n=6\\left(1-\\left(\\tfrac12\\right)^{n+1}\\right)$.",
    "w": 3,
    "s": "Il y a $n+1$ termes et $q\\ne1$ : $S_n=u_0\\dfrac{1-q^{n+1}}{1-q}=3\\times\\dfrac{1-(1/2)^{n+1}}{1/2}=6\\left(1-\\left(\\tfrac12\\right)^{n+1}\\right)$."
   },
   {
    "q": "Calculer $S_4$, puis montrer que $S_n\\lt6$ pour tout $n$.",
    "w": 3,
    "s": "$S_4=6\\left(1-\\dfrac1{32}\\right)=\\dfrac{6\\times31}{32}=\\dfrac{93}{16}$.<br>$\\left(\\tfrac12\\right)^{n+1}\\gt0$, donc $1-\\left(\\tfrac12\\right)^{n+1}\\lt1$ et $S_n\\lt6$."
   }
  ]
 },
 {
  "id": "bar-1",
  "chapter": "1bac-math-4",
  "title": "Barycentre de deux points et ensemble de points",
  "questions": [
   {
    "q": "Soit $[AB]$ un segment de longueur $5$ cm et $G$ le barycentre de $(A;2)$ et $(B;3)$. Exprimer $\\overrightarrow{AG}$ en fonction de $\\overrightarrow{AB}$ et placer $G$.",
    "w": 2,
    "s": "$2\\overrightarrow{GA}+3\\overrightarrow{GB}=\\vec0$. Avec Chasles $\\overrightarrow{GB}=\\overrightarrow{GA}+\\overrightarrow{AB}$ : $5\\overrightarrow{GA}+3\\overrightarrow{AB}=\\vec0$, donc $\\overrightarrow{AG}=\\dfrac35\\overrightarrow{AB}$.<br>$G$ est sur $[AB]$ à $3$ cm de $A$."
   },
   {
    "q": "Montrer que pour tout point $M$ du plan : $2\\overrightarrow{MA}+3\\overrightarrow{MB}=5\\overrightarrow{MG}$.",
    "w": 2,
    "s": "$2\\overrightarrow{MA}+3\\overrightarrow{MB}=2(\\overrightarrow{MG}+\\overrightarrow{GA})+3(\\overrightarrow{MG}+\\overrightarrow{GB})=5\\overrightarrow{MG}+\\underbrace{2\\overrightarrow{GA}+3\\overrightarrow{GB}}_{=\\vec0}=5\\overrightarrow{MG}$."
   },
   {
    "q": "Déterminer l'ensemble $(\\Gamma)$ des points $M$ tels que $\\|2\\overrightarrow{MA}+3\\overrightarrow{MB}\\|=10$.",
    "w": 3,
    "s": "$\\|2\\overrightarrow{MA}+3\\overrightarrow{MB}\\|=10\\iff\\|5\\overrightarrow{MG}\\|=10\\iff MG=2$.<br>$(\\Gamma)$ est le <b>cercle de centre $G$ et de rayon $2$ cm</b>."
   }
  ]
 },
 {
  "id": "bar-2",
  "chapter": "1bac-math-4",
  "title": "Associativité du barycentre",
  "questions": [
   {
    "q": "$ABC$ est un triangle et $G$ le barycentre de $(A;1)$, $(B;2)$, $(C;1)$. Soit $I$ le milieu de $[AC]$. Justifier que $I$ est le barycentre de $(A;1)$ et $(C;1)$.",
    "w": 2,
    "s": "$I$ milieu de $[AC]$ $\\iff\\overrightarrow{IA}+\\overrightarrow{IC}=\\vec0$, c'est exactement la définition du barycentre de $(A;1)$ et $(C;1)$."
   },
   {
    "q": "En utilisant l'associativité, montrer que $G$ est le milieu de $[IB]$.",
    "w": 3,
    "s": "On regroupe $(A;1)$ et $(C;1)$ : ils sont remplacés par $(I;2)$. Donc $G$ est le barycentre de $(I;2)$ et $(B;2)$ : coefficients égaux, $G$ est le <b>milieu</b> de $[IB]$."
   },
   {
    "q": "Exprimer $\\overrightarrow{AG}$ en fonction de $\\overrightarrow{AB}$ et $\\overrightarrow{AC}$.",
    "w": 3,
    "s": "$\\overrightarrow{AG}=\\dfrac{1\\cdot\\overrightarrow{AA}+2\\overrightarrow{AB}+1\\cdot\\overrightarrow{AC}}{1+2+1}=\\dfrac12\\overrightarrow{AB}+\\dfrac14\\overrightarrow{AC}$."
   }
  ]
 },
 {
  "id": "bar-3",
  "chapter": "1bac-math-4",
  "title": "Barycentre et coordonnées",
  "questions": [
   {
    "q": "Dans un repère, $A(1;2)$, $B(4;-1)$ et $C(-2;3)$. Calculer les coordonnées du barycentre $G$ de $(A;1)$, $(B;2)$, $(C;-1)$.",
    "w": 3,
    "s": "La somme des coefficients est $1+2-1=2\\ne0$, $G$ existe.<br>$x_G=\\dfrac{1\\times1+2\\times4-1\\times(-2)}2=\\dfrac{11}2$ ; $y_G=\\dfrac{1\\times2+2\\times(-1)-1\\times3}2=-\\dfrac32$. $G\\left(\\tfrac{11}2;-\\tfrac32\\right)$."
   },
   {
    "q": "Calculer les coordonnées du centre de gravité $K$ du triangle $ABC$.",
    "w": 3,
    "s": "$K$ est le barycentre de $(A;1)$, $(B;1)$, $(C;1)$ : $x_K=\\dfrac{1+4-2}3=1$, $y_K=\\dfrac{2-1+3}3=\\dfrac43$. $K\\left(1;\\tfrac43\\right)$."
   },
   {
    "q": "Déterminer les coordonnées du point $D$ tel que $A$ soit le barycentre de $(B;1)$ et $(D;2)$.",
    "w": 2,
    "s": "$x_A=\\dfrac{x_B+2x_D}3$, donc $1=\\dfrac{4+2x_D}3$, $x_D=-\\dfrac12$ ; $2=\\dfrac{-1+2y_D}3$, $y_D=\\dfrac72$. $D\\left(-\\tfrac12;\\tfrac72\\right)$."
   }
  ]
 },
 {
  "id": "bar-4",
  "chapter": "1bac-math-4",
  "title": "Alignement et concours de droites",
  "questions": [
   {
    "q": "$ABC$ est un triangle. $I$ est le barycentre de $(A;1)$, $(B;2)$ et $J$ celui de $(B;2)$, $(C;3)$. Placer $I$ et $J$ en exprimant $\\overrightarrow{AI}$ et $\\overrightarrow{BJ}$.",
    "w": 2,
    "s": "$\\overrightarrow{AI}=\\dfrac{2}{3}\\overrightarrow{AB}$ et $\\overrightarrow{BJ}=\\dfrac35\\overrightarrow{BC}$ (formule $\\overrightarrow{AG}=\\dfrac{b}{a+b}\\overrightarrow{AB}$)."
   },
   {
    "q": "Soit $G$ le barycentre de $(A;1)$, $(B;2)$, $(C;3)$. Montrer que $G$ est le milieu de $[IC]$, puis que $G\\in(AJ)$.",
    "w": 4,
    "s": "Associativité : $(A;1),(B;2)$ remplacés par $(I;3)$, donc $G$ est le barycentre de $(I;3)$, $(C;3)$ : $G$ est le milieu de $[IC]$.<br>De même $(B;2),(C;3)$ remplacés par $(J;5)$ : $G$ est le barycentre de $(A;1)$, $(J;5)$, donc $G\\in(AJ)$."
   },
   {
    "q": "En déduire que les droites $(IC)$ et $(AJ)$ sont sécantes en $G$.",
    "w": 2,
    "s": "$G$ appartient à $(IC)$ et à $(AJ)$. Ces droites ne sont pas confondues ($A\\notin(IC)$ car $I\\ne A$ et $A,B,C$ ne sont pas alignés), donc elles se coupent en $G$."
   }
  ]
 },
 {
  "id": "bar-5",
  "chapter": "1bac-math-4",
  "title": "Ensembles de points",
  "questions": [
   {
    "q": "$ABC$ est un triangle avec $AB=8$. $G$ est le barycentre de $(A;1)$, $(B;1)$, $(C;2)$. Simplifier $\\overrightarrow{MA}+\\overrightarrow{MB}+2\\overrightarrow{MC}$ et $\\overrightarrow{MA}-\\overrightarrow{MB}$.",
    "w": 2,
    "s": "$\\overrightarrow{MA}+\\overrightarrow{MB}+2\\overrightarrow{MC}=4\\overrightarrow{MG}$ (propriété du barycentre, somme des coefficients $4$).<br>$\\overrightarrow{MA}-\\overrightarrow{MB}=\\overrightarrow{MA}+\\overrightarrow{BM}=\\overrightarrow{BA}$ (vecteur constant)."
   },
   {
    "q": "Déterminer l'ensemble des points $M$ tels que $\\|\\overrightarrow{MA}+\\overrightarrow{MB}+2\\overrightarrow{MC}\\|=\\|\\overrightarrow{MA}-\\overrightarrow{MB}\\|$.",
    "w": 3,
    "s": "L'égalité devient $4MG=BA=8$, soit $MG=2$ : c'est le <b>cercle de centre $G$ et de rayon $2$</b>."
   },
   {
    "q": "Déterminer l'ensemble des points $M$ tels que $\\|\\overrightarrow{MA}+\\overrightarrow{MB}+2\\overrightarrow{MC}\\|=\\|2\\overrightarrow{MA}+2\\overrightarrow{MB}\\|$.",
    "w": 3,
    "s": "Soit $I$ le milieu de $[AB]$ : $2\\overrightarrow{MA}+2\\overrightarrow{MB}=4\\overrightarrow{MI}$. L'égalité devient $4MG=4MI$, soit $MG=MI$ : c'est la <b>médiatrice du segment $[GI]$</b>."
   }
  ]
 },
 {
  "id": "bar-6",
  "chapter": "1bac-math-4",
  "title": "Barycentre avec paramètre",
  "questions": [
   {
    "q": "Soient $A$ et $B$ deux points distincts et $m$ un réel. À quelle condition le barycentre $G_m$ de $(A;1)$ et $(B;m)$ existe-t-il ?",
    "w": 2,
    "s": "Il existe si et seulement si la somme des coefficients est non nulle : $1+m\\ne0$, soit $m\\ne-1$."
   },
   {
    "q": "Montrer que $\\overrightarrow{AG_m}=\\dfrac{m}{1+m}\\overrightarrow{AB}$.",
    "w": 2,
    "s": "$\\overrightarrow{G_mA}+m\\overrightarrow{G_mB}=\\vec0$ et $\\overrightarrow{G_mB}=\\overrightarrow{G_mA}+\\overrightarrow{AB}$, donc $(1+m)\\overrightarrow{G_mA}+m\\overrightarrow{AB}=\\vec0$, soit $\\overrightarrow{AG_m}=\\dfrac m{1+m}\\overrightarrow{AB}$."
   },
   {
    "q": "Déterminer $m$ pour que $G_m$ soit le milieu de $[AB]$, puis pour que $\\overrightarrow{AG_m}=2\\overrightarrow{AB}$.",
    "w": 4,
    "s": "Milieu : $\\dfrac m{1+m}=\\dfrac12\\iff2m=1+m\\iff m=1$.<br>$\\dfrac m{1+m}=2\\iff m=2+2m\\iff m=-2$ (on a bien $m\\ne-1$)."
   }
  ]
 },
 {
  "id": "ps-1",
  "chapter": "1bac-math-5",
  "title": "Produit scalaire et théorème d'Al-Kashi",
  "questions": [
   {
    "q": "$ABC$ est un triangle tel que $AB=4$, $AC=3$ et $\\widehat{BAC}=\\dfrac\\pi3$. Calculer $\\overrightarrow{AB}\\cdot\\overrightarrow{AC}$.",
    "w": 2,
    "s": "$\\overrightarrow{AB}\\cdot\\overrightarrow{AC}=AB\\times AC\\times\\cos\\widehat{BAC}=4\\times3\\times\\dfrac12=6$."
   },
   {
    "q": "En déduire la longueur $BC$.",
    "w": 3,
    "s": "$\\overrightarrow{BC}=\\overrightarrow{AC}-\\overrightarrow{AB}$, donc $BC^2=AC^2-2\\overrightarrow{AB}\\cdot\\overrightarrow{AC}+AB^2=9-12+16=13$ (théorème d'Al-Kashi). $BC=\\sqrt{13}$."
   },
   {
    "q": "Calculer $\\overrightarrow{AB}\\cdot\\overrightarrow{BC}$.",
    "w": 3,
    "s": "$\\overrightarrow{AB}\\cdot\\overrightarrow{BC}=\\overrightarrow{AB}\\cdot(\\overrightarrow{AC}-\\overrightarrow{AB})=\\overrightarrow{AB}\\cdot\\overrightarrow{AC}-AB^2=6-16=-10$."
   }
  ]
 },
 {
  "id": "ps-2",
  "chapter": "1bac-math-5",
  "title": "Produit scalaire en repère orthonormé",
  "questions": [
   {
    "q": "Dans un repère orthonormé, $\\vec u(2;-1)$ et $\\vec v(1;3)$. Calculer $\\vec u\\cdot\\vec v$, $\\|\\vec u\\|$ et $\\|\\vec v\\|$.",
    "w": 2,
    "s": "$\\vec u\\cdot\\vec v=2\\times1+(-1)\\times3=-1$ ; $\\|\\vec u\\|=\\sqrt{4+1}=\\sqrt5$ ; $\\|\\vec v\\|=\\sqrt{1+9}=\\sqrt{10}$."
   },
   {
    "q": "En déduire $\\cos(\\vec u,\\vec v)$. L'angle est-il aigu ou obtus ?",
    "w": 3,
    "s": "$\\cos(\\vec u,\\vec v)=\\dfrac{\\vec u\\cdot\\vec v}{\\|\\vec u\\|\\|\\vec v\\|}=\\dfrac{-1}{\\sqrt{50}}=-\\dfrac{\\sqrt2}{10}$.<br>Le cosinus est négatif : l'angle géométrique est <b>obtus</b>."
   },
   {
    "q": "Déterminer le réel $m$ pour que $\\vec w(m;4)$ soit orthogonal à $\\vec u$.",
    "w": 3,
    "s": "$\\vec u\\perp\\vec w\\iff\\vec u\\cdot\\vec w=0\\iff2m-4=0\\iff m=2$."
   }
  ]
 },
 {
  "id": "ps-3",
  "chapter": "1bac-math-5",
  "title": "Équations de droites et distance",
  "questions": [
   {
    "q": "Dans un repère orthonormé, déterminer une équation de la droite $(D)$ passant par $A(1;2)$ et de vecteur normal $\\vec n(3;-1)$.",
    "w": 2,
    "s": "$M(x;y)\\in(D)\\iff\\overrightarrow{AM}\\cdot\\vec n=0\\iff3(x-1)-(y-2)=0\\iff3x-y-1=0$."
   },
   {
    "q": "Calculer la distance du point $B(4;0)$ à la droite $(D)$.",
    "w": 3,
    "s": "$d(B;(D))=\\dfrac{|3\\times4-0-1|}{\\sqrt{3^2+(-1)^2}}=\\dfrac{11}{\\sqrt{10}}=\\dfrac{11\\sqrt{10}}{10}$."
   },
   {
    "q": "Déterminer une équation de la médiatrice du segment $[AC]$ avec $C(3;6)$.",
    "w": 3,
    "s": "La médiatrice passe par le milieu $I(2;4)$ et a pour vecteur normal $\\overrightarrow{AC}(2;4)$ : $2(x-2)+4(y-4)=0$, soit $x+2y-10=0$."
   }
  ]
 },
 {
  "id": "ps-4",
  "chapter": "1bac-math-5",
  "title": "Cercle : équation, droite sécante, tangente",
  "questions": [
   {
    "q": "Soit $(\\mathscr C)$ l'ensemble des points $M(x;y)$ tels que $x^2+y^2-4x+6y-3=0$. Montrer que $(\\mathscr C)$ est un cercle dont on précisera le centre $\\Omega$ et le rayon $R$.",
    "w": 3,
    "s": "On complète les carrés : $(x-2)^2-4+(y+3)^2-9-3=0$, soit $(x-2)^2+(y+3)^2=16$.<br>$(\\mathscr C)$ est le cercle de centre $\\Omega(2;-3)$ et de rayon $R=4$."
   },
   {
    "q": "Étudier la position de la droite $(\\Delta):3x+4y+11=0$ par rapport à $(\\mathscr C)$.",
    "w": 2,
    "s": "$d(\\Omega;(\\Delta))=\\dfrac{|6-12+11|}{\\sqrt{9+16}}=\\dfrac55=1$. Comme $1\\lt R=4$, la droite <b>coupe</b> le cercle en deux points."
   },
   {
    "q": "Vérifier que $A(2;1)\\in(\\mathscr C)$ et donner une équation de la tangente à $(\\mathscr C)$ en $A$.",
    "w": 3,
    "s": "$(2-2)^2+(1+3)^2=16$ : $A\\in(\\mathscr C)$.<br>La tangente en $A$ est perpendiculaire à $(\\Omega A)$ ; $\\overrightarrow{\\Omega A}(0;4)$ est normal : $0(x-2)+4(y-1)=0$, soit $y=1$."
   }
  ]
 },
 {
  "id": "ps-5",
  "chapter": "1bac-math-5",
  "title": "Ensemble de points et cercle de diamètre donné",
  "questions": [
   {
    "q": "Dans un repère orthonormé, $A(-1;0)$ et $B(3;2)$. Déterminer une équation de l'ensemble $(\\Gamma)$ des points $M$ tels que $\\overrightarrow{MA}\\cdot\\overrightarrow{MB}=0$.",
    "w": 3,
    "s": "$\\overrightarrow{MA}(-1-x;-y)$ et $\\overrightarrow{MB}(3-x;2-y)$ : $(-1-x)(3-x)+(-y)(2-y)=0\\iff x^2-2x-3+y^2-2y=0$."
   },
   {
    "q": "Montrer que $(\\Gamma)$ est le cercle de diamètre $[AB]$ ; préciser son centre et son rayon.",
    "w": 3,
    "s": "$x^2-2x+y^2-2y-3=0\\iff(x-1)^2+(y-1)^2=5$ : cercle de centre $I(1;1)$ et de rayon $\\sqrt5$.<br>$I$ est le milieu de $[AB]$ et $AB=\\sqrt{16+4}=2\\sqrt5$, donc le rayon est $\\dfrac{AB}2$ : c'est le cercle de diamètre $[AB]$."
   },
   {
    "q": "Le point $O(0;0)$ appartient-il à $(\\Gamma)$ ? Que peut-on dire du triangle $OAB$ ?",
    "w": 2,
    "s": "$0-0+0-0-3=-3\\ne0$ : $O\\notin(\\Gamma)$. Donc $\\overrightarrow{OA}\\cdot\\overrightarrow{OB}\\ne0$ ; en effet $\\overrightarrow{OA}\\cdot\\overrightarrow{OB}=-3$ : le triangle $OAB$ n'est pas rectangle en $O$ (l'angle en $O$ est obtus)."
   }
  ]
 },
 {
  "id": "ps-6",
  "chapter": "1bac-math-5",
  "title": "Relations métriques dans un triangle",
  "questions": [
   {
    "q": "$ABC$ est un triangle tel que $AB=5$, $AC=7$ et $BC=8$. Calculer $\\cos\\widehat{BAC}$.",
    "w": 2,
    "s": "Al-Kashi : $BC^2=AB^2+AC^2-2AB\\cdot AC\\cos\\widehat A$, donc $64=25+49-70\\cos\\widehat A$, soit $\\cos\\widehat A=\\dfrac{10}{70}=\\dfrac17$."
   },
   {
    "q": "Calculer $\\overrightarrow{AB}\\cdot\\overrightarrow{AC}$ et l'aire du triangle $ABC$.",
    "w": 3,
    "s": "$\\overrightarrow{AB}\\cdot\\overrightarrow{AC}=5\\times7\\times\\dfrac17=5$.<br>$\\sin\\widehat A=\\sqrt{1-\\dfrac1{49}}=\\dfrac{\\sqrt{48}}7=\\dfrac{4\\sqrt3}7$ (l'angle est entre $0$ et $\\pi$, le sinus est positif).<br>Aire $=\\dfrac12AB\\cdot AC\\sin\\widehat A=\\dfrac12\\times35\\times\\dfrac{4\\sqrt3}7=10\\sqrt3$."
   },
   {
    "q": "Soit $I$ le milieu de $[BC]$. Calculer $AI$ (théorème de la médiane).",
    "w": 3,
    "s": "$AB^2+AC^2=2AI^2+\\dfrac{BC^2}2$, donc $74=2AI^2+32$, $AI^2=21$ et $AI=\\sqrt{21}$."
   }
  ]
 },
 {
  "id": "tri-1",
  "chapter": "1bac-math-6",
  "title": "Formules d'addition",
  "questions": [
   {
    "q": "En remarquant que $\\dfrac\\pi{12}=\\dfrac\\pi3-\\dfrac\\pi4$, calculer $\\cos\\dfrac\\pi{12}$ et $\\sin\\dfrac\\pi{12}$.",
    "w": 3,
    "s": "$\\cos\\left(\\dfrac\\pi3-\\dfrac\\pi4\\right)=\\cos\\dfrac\\pi3\\cos\\dfrac\\pi4+\\sin\\dfrac\\pi3\\sin\\dfrac\\pi4=\\dfrac12\\cdot\\dfrac{\\sqrt2}2+\\dfrac{\\sqrt3}2\\cdot\\dfrac{\\sqrt2}2=\\dfrac{\\sqrt2+\\sqrt6}4$.<br>$\\sin\\left(\\dfrac\\pi3-\\dfrac\\pi4\\right)=\\sin\\dfrac\\pi3\\cos\\dfrac\\pi4-\\cos\\dfrac\\pi3\\sin\\dfrac\\pi4=\\dfrac{\\sqrt6-\\sqrt2}4$."
   },
   {
    "q": "En déduire $\\tan\\dfrac\\pi{12}=2-\\sqrt3$.",
    "w": 3,
    "s": "$\\tan\\dfrac\\pi{12}=\\dfrac{\\sqrt6-\\sqrt2}{\\sqrt6+\\sqrt2}=\\dfrac{(\\sqrt6-\\sqrt2)^2}{6-2}=\\dfrac{8-2\\sqrt{12}}4=\\dfrac{8-4\\sqrt3}4=2-\\sqrt3$."
   },
   {
    "q": "Calculer $\\cos\\dfrac{7\\pi}{12}$ (remarquer que $\\dfrac{7\\pi}{12}=\\dfrac\\pi2+\\dfrac\\pi{12}$).",
    "w": 2,
    "s": "$\\cos\\left(\\dfrac\\pi2+\\dfrac\\pi{12}\\right)=-\\sin\\dfrac\\pi{12}=\\dfrac{\\sqrt2-\\sqrt6}4$."
   }
  ]
 },
 {
  "id": "tri-2",
  "chapter": "1bac-math-6",
  "title": "Simplification d'expressions",
  "questions": [
   {
    "q": "Simplifier $A=\\sin(\\pi-x)+\\cos\\left(\\dfrac\\pi2-x\\right)-\\sin(x+\\pi)$.",
    "w": 3,
    "s": "$\\sin(\\pi-x)=\\sin x$ ; $\\cos\\left(\\dfrac\\pi2-x\\right)=\\sin x$ ; $\\sin(x+\\pi)=-\\sin x$. Donc $A=\\sin x+\\sin x+\\sin x=3\\sin x$."
   },
   {
    "q": "Simplifier $B=\\cos(\\pi+x)+\\cos(-x)+\\sin\\left(\\dfrac\\pi2+x\\right)$.",
    "w": 3,
    "s": "$\\cos(\\pi+x)=-\\cos x$ ; $\\cos(-x)=\\cos x$ ; $\\sin\\left(\\dfrac\\pi2+x\\right)=\\cos x$. Donc $B=\\cos x$."
   },
   {
    "q": "Montrer que pour tout réel $x$ : $(\\cos x+\\sin x)^2=1+\\sin2x$.",
    "w": 2,
    "s": "$(\\cos x+\\sin x)^2=\\cos^2x+2\\sin x\\cos x+\\sin^2x=1+\\sin2x$ (car $\\cos^2x+\\sin^2x=1$ et $2\\sin x\\cos x=\\sin2x$)."
   }
  ]
 },
 {
  "id": "tri-3",
  "chapter": "1bac-math-6",
  "title": "Équations trigonométriques",
  "questions": [
   {
    "q": "Résoudre dans $]-\\pi;\\pi]$ l'équation $\\cos x=\\dfrac12$.",
    "w": 2,
    "s": "$\\cos x=\\cos\\dfrac\\pi3\\iff x=\\dfrac\\pi3+2k\\pi$ ou $x=-\\dfrac\\pi3+2k\\pi$. Dans $]-\\pi;\\pi]$ : $S=\\left\\{-\\dfrac\\pi3;\\dfrac\\pi3\\right\\}$."
   },
   {
    "q": "Résoudre dans $[0;2\\pi[$ l'équation $2\\sin^2x-\\sin x-1=0$ (poser $X=\\sin x$).",
    "w": 4,
    "s": "$2X^2-X-1=0$ : $\\Delta=1+8=9$, $X=\\dfrac{1+3}4=1$ ou $X=\\dfrac{1-3}4=-\\dfrac12$.<br>$\\sin x=1\\iff x=\\dfrac\\pi2$ ; $\\sin x=-\\dfrac12\\iff x=\\dfrac{7\\pi}6$ ou $x=\\dfrac{11\\pi}6$.<br>$S=\\left\\{\\dfrac\\pi2;\\dfrac{7\\pi}6;\\dfrac{11\\pi}6\\right\\}$."
   },
   {
    "q": "Résoudre dans $\\mathbb R$ l'équation $\\tan x=\\sqrt3$.",
    "w": 2,
    "s": "$\\tan x=\\tan\\dfrac\\pi3\\iff x=\\dfrac\\pi3+k\\pi$, $k\\in\\mathbb Z$."
   }
  ]
 },
 {
  "id": "tri-4",
  "chapter": "1bac-math-6",
  "title": "Transformation de a cos x + b sin x",
  "questions": [
   {
    "q": "Montrer que pour tout réel $x$ : $\\sqrt3\\cos x+\\sin x=2\\cos\\left(x-\\dfrac\\pi6\\right)$.",
    "w": 3,
    "s": "$\\sqrt3\\cos x+\\sin x=2\\left(\\dfrac{\\sqrt3}2\\cos x+\\dfrac12\\sin x\\right)=2\\left(\\cos\\dfrac\\pi6\\cos x+\\sin\\dfrac\\pi6\\sin x\\right)=2\\cos\\left(x-\\dfrac\\pi6\\right)$."
   },
   {
    "q": "Résoudre dans $[0;2\\pi[$ l'équation $\\sqrt3\\cos x+\\sin x=\\sqrt2$.",
    "w": 3,
    "s": "L'équation devient $\\cos\\left(x-\\dfrac\\pi6\\right)=\\dfrac{\\sqrt2}2=\\cos\\dfrac\\pi4$, donc $x-\\dfrac\\pi6=\\pm\\dfrac\\pi4+2k\\pi$.<br>$x=\\dfrac{5\\pi}{12}+2k\\pi$ ou $x=-\\dfrac\\pi{12}+2k\\pi$. Dans $[0;2\\pi[$ : $S=\\left\\{\\dfrac{5\\pi}{12};\\dfrac{23\\pi}{12}\\right\\}$."
   },
   {
    "q": "Quelles sont les valeurs maximale et minimale de $\\sqrt3\\cos x+\\sin x$ ?",
    "w": 2,
    "s": "$-1\\le\\cos\\left(x-\\dfrac\\pi6\\right)\\le1$, donc l'expression varie entre $-2$ et $2$ : maximum $2$ (pour $x=\\dfrac\\pi6$), minimum $-2$ (pour $x=\\dfrac{7\\pi}6$)."
   }
  ]
 },
 {
  "id": "tri-5",
  "chapter": "1bac-math-6",
  "title": "Inéquations trigonométriques",
  "questions": [
   {
    "q": "Résoudre dans $]-\\pi;\\pi]$ l'inéquation $2\\cos x-1\\ge0$.",
    "w": 3,
    "s": "$2\\cos x-1\\ge0\\iff\\cos x\\ge\\dfrac12$. Sur le cercle trigonométrique, les points d'abscisse supérieure ou égale à $\\dfrac12$ correspondent à $x\\in\\left[-\\dfrac\\pi3;\\dfrac\\pi3\\right]$."
   },
   {
    "q": "Résoudre dans $[0;2\\pi[$ l'inéquation $\\sin x\\lt-\\dfrac{\\sqrt2}2$.",
    "w": 3,
    "s": "$\\sin x=-\\dfrac{\\sqrt2}2$ pour $x=\\dfrac{5\\pi}4$ et $x=\\dfrac{7\\pi}4$. Les points d'ordonnée strictement inférieure à $-\\dfrac{\\sqrt2}2$ sont sur l'arc entre eux : $S=\\left]\\dfrac{5\\pi}4;\\dfrac{7\\pi}4\\right[$."
   },
   {
    "q": "En déduire les solutions dans $]-\\pi;\\pi]$ de $(2\\cos x-1)\\sin x\\ge0$.",
    "w": 2,
    "s": "Tableau de signes sur $]-\\pi;\\pi]$ : $2\\cos x-1\\ge0$ sur $\\left[-\\dfrac\\pi3;\\dfrac\\pi3\\right]$ ; $\\sin x\\ge0$ sur $[0;\\pi]$.<br>Le produit est positif quand les deux facteurs ont le même signe : $S=\\left]-\\pi;-\\dfrac\\pi3\\right]\\cup\\left[0;\\dfrac\\pi3\\right]\\cup\\{\\pi\\}$."
   }
  ]
 },
 {
  "id": "tri-6",
  "chapter": "1bac-math-6",
  "title": "Formules de duplication",
  "questions": [
   {
    "q": "En utilisant $\\cos2a=2\\cos^2a-1$, calculer $\\cos\\dfrac\\pi8$.",
    "w": 3,
    "s": "$\\cos\\dfrac\\pi4=2\\cos^2\\dfrac\\pi8-1$, donc $\\cos^2\\dfrac\\pi8=\\dfrac{1+\\frac{\\sqrt2}2}2=\\dfrac{2+\\sqrt2}4$.<br>$\\dfrac\\pi8\\in\\left[0;\\dfrac\\pi2\\right]$, son cosinus est positif : $\\cos\\dfrac\\pi8=\\dfrac{\\sqrt{2+\\sqrt2}}2$."
   },
   {
    "q": "Montrer que pour tout réel $x$ : $\\sin3x=3\\sin x-4\\sin^3x$.",
    "w": 3,
    "s": "$\\sin3x=\\sin(2x+x)=\\sin2x\\cos x+\\cos2x\\sin x=2\\sin x\\cos^2x+(1-2\\sin^2x)\\sin x$.<br>Avec $\\cos^2x=1-\\sin^2x$ : $\\sin3x=2\\sin x-2\\sin^3x+\\sin x-2\\sin^3x=3\\sin x-4\\sin^3x$."
   },
   {
    "q": "Résoudre dans $[0;2\\pi[$ l'équation $\\cos2x=\\cos x$.",
    "w": 2,
    "s": "$\\cos2x=\\cos x\\iff2x=x+2k\\pi$ ou $2x=-x+2k\\pi\\iff x=2k\\pi$ ou $x=\\dfrac{2k\\pi}3$.<br>Dans $[0;2\\pi[$ : $S=\\left\\{0;\\dfrac{2\\pi}3;\\dfrac{4\\pi}3\\right\\}$."
   }
  ]
 },
 {
  "id": "rot-1",
  "chapter": "1bac-math-7",
  "title": "Image d'un point et d'une droite par un quart de tour",
  "questions": [
   {
    "q": "Dans un repère orthonormé direct, $r$ est la rotation de centre $O$ et d'angle $\\dfrac\\pi2$. Construire l'image $A'$ de $A(2;1)$ et donner ses coordonnées.",
    "w": 3,
    "s": "$OA'=OA$ et $(\\overrightarrow{OA},\\overrightarrow{OA'})=\\dfrac\\pi2$. Le vecteur $(2;1)$ tourné d'un quart de tour direct devient $(-1;2)$ : $A'(-1;2)$.<br>Vérification : $\\overrightarrow{OA}\\cdot\\overrightarrow{OA'}=-2+2=0$ et $OA=OA'=\\sqrt5$."
   },
   {
    "q": "Plus généralement, justifier que l'image de $M(x;y)$ est $M'(-y;x)$.",
    "w": 2,
    "s": "Le vecteur $(-y;x)$ a la même norme que $(x;y)$, il lui est orthogonal ($-xy+yx=0$), et le déterminant $\\begin{vmatrix}x&-y\\\\y&x\\end{vmatrix}=x^2+y^2\\gt0$ indique un angle direct de $+\\dfrac\\pi2$."
   },
   {
    "q": "Déterminer l'image par $r$ de la droite $(D):y=x+1$.",
    "w": 3,
    "s": "Un point de $(D)$ s'écrit $M(t;t+1)$ ; son image est $M'(-t-1;t)$. En posant $X=-t-1$ et $Y=t$ : $X=-Y-1$, soit $X+Y+1=0$.<br>L'image de $(D)$ est la droite $(D'):x+y+1=0$ (perpendiculaire à $(D)$, comme prévu pour un quart de tour)."
   }
  ]
 },
 {
  "id": "rot-2",
  "chapter": "1bac-math-7",
  "title": "Triangles équilatéraux et rotation",
  "questions": [
   {
    "q": "$ABC$ est un triangle. On construit à l'extérieur les triangles équilatéraux $ABD$ et $ACE$, de sorte que $(\\overrightarrow{AD},\\overrightarrow{AB})\\equiv\\dfrac\\pi3$ et $(\\overrightarrow{AC},\\overrightarrow{AE})\\equiv\\dfrac\\pi3\\ [2\\pi]$. Soit $r$ la rotation de centre $A$ et d'angle $\\dfrac\\pi3$. Déterminer $r(D)$ et $r(C)$.",
    "w": 2,
    "s": "$AD=AB$ et $(\\overrightarrow{AD},\\overrightarrow{AB})\\equiv\\dfrac\\pi3$ : donc $r(D)=B$.<br>$AC=AE$ et $(\\overrightarrow{AC},\\overrightarrow{AE})\\equiv\\dfrac\\pi3$ : donc $r(C)=E$."
   },
   {
    "q": "En déduire que $DC=BE$.",
    "w": 3,
    "s": "$r$ transforme le segment $[DC]$ en $[BE]$. Une rotation conserve les distances : $DC=BE$."
   },
   {
    "q": "Quelle est la mesure de l'angle orienté $(\\overrightarrow{DC},\\overrightarrow{BE})$ ?",
    "w": 3,
    "s": "Une rotation d'angle $\\theta$ transforme tout vecteur $\\vec u$ en un vecteur $\\vec u'$ tel que $(\\vec u,\\vec u')\\equiv\\theta$. Comme $r(\\overrightarrow{DC})=\\overrightarrow{BE}$ : $(\\overrightarrow{DC},\\overrightarrow{BE})\\equiv\\dfrac\\pi3\\ [2\\pi]$."
   }
  ]
 },
 {
  "id": "rot-3",
  "chapter": "1bac-math-7",
  "title": "Rotation et carré",
  "questions": [
   {
    "q": "$ABCD$ est un carré direct de centre $O$. Soit $r$ la rotation de centre $O$ et d'angle $\\dfrac\\pi2$. Déterminer $r(A)$, $r(B)$, $r(C)$ et $r(D)$.",
    "w": 2,
    "s": "Les diagonales d'un carré ont même longueur, se coupent en leur milieu $O$ et sont perpendiculaires. Donc $OA=OB=OC=OD$ et $(\\overrightarrow{OA},\\overrightarrow{OB})\\equiv\\dfrac\\pi2$ (carré direct).<br>$r(A)=B$, $r(B)=C$, $r(C)=D$, $r(D)=A$."
   },
   {
    "q": "$I$ est le milieu de $[AB]$ et $J$ celui de $[BC]$. Montrer que $r(I)=J$ et en déduire la nature du triangle $OIJ$.",
    "w": 3,
    "s": "Une rotation conserve les milieux : $r([AB])=[BC]$, donc $r(I)=J$.<br>Ainsi $OI=OJ$ et $(\\overrightarrow{OI},\\overrightarrow{OJ})\\equiv\\dfrac\\pi2$ : $OIJ$ est <b>rectangle isocèle</b> en $O$."
   },
   {
    "q": "Soit $M$ un point de $[AB]$ et $N=r(M)$. Montrer que $N\\in[BC]$ et que $OM=ON$, $(OM)\\perp(ON)$.",
    "w": 3,
    "s": "$M\\in[AB]$ et $r([AB])=[BC]$, donc $N=r(M)\\in[BC]$.<br>Par définition de la rotation : $OM=ON$ et $(\\overrightarrow{OM},\\overrightarrow{ON})\\equiv\\dfrac\\pi2$, donc $(OM)\\perp(ON)$."
   }
  ]
 },
 {
  "id": "rot-4",
  "chapter": "1bac-math-7",
  "title": "Image d'un cercle, conservation des propriétés",
  "questions": [
   {
    "q": "$(\\mathscr C)$ est le cercle de centre $O$ et de rayon $3$, $A$ un point extérieur et $r$ la rotation de centre $A$ et d'angle $-\\dfrac\\pi2$. Déterminer l'image $(\\mathscr C')$ de $(\\mathscr C)$.",
    "w": 3,
    "s": "Une rotation conserve les distances : l'image d'un cercle de centre $O$ et de rayon $3$ est le cercle de centre $O'=r(O)$ et de même rayon $3$."
   },
   {
    "q": "Préciser la position de $O'$ et calculer $OO'$ si $AO=4$.",
    "w": 3,
    "s": "$AO'=AO=4$ et $(\\overrightarrow{AO},\\overrightarrow{AO'})\\equiv-\\dfrac\\pi2$ : le triangle $AOO'$ est rectangle isocèle en $A$.<br>$OO'=\\sqrt{4^2+4^2}=4\\sqrt2$."
   },
   {
    "q": "Les cercles $(\\mathscr C)$ et $(\\mathscr C')$ sont-ils sécants ?",
    "w": 2,
    "s": "Deux cercles de rayon $3$ sont sécants si la distance de leurs centres est inférieure à $3+3=6$. Ici $OO'=4\\sqrt2\\approx5{,}66\\lt6$ : ils sont <b>sécants</b> en deux points."
   }
  ]
 },
 {
  "id": "rot-5",
  "chapter": "1bac-math-7",
  "title": "Construction à l'aide d'une rotation",
  "questions": [
   {
    "q": "$(D_1)$ et $(D_2)$ sont deux droites sécantes et $A$ un point n'appartenant à aucune d'elles. On cherche $B\\in(D_1)$ et $C\\in(D_2)$ tels que $ABC$ soit équilatéral direct. Montrer que $C=r(B)$ où $r$ est la rotation de centre $A$ et d'angle $\\dfrac\\pi3$.",
    "w": 3,
    "s": "$ABC$ équilatéral direct $\\iff AB=AC$ et $(\\overrightarrow{AB},\\overrightarrow{AC})\\equiv\\dfrac\\pi3\\iff C=r(B)$."
   },
   {
    "q": "En déduire que $C$ appartient à $(D_2)\\cap(D_1')$ où $(D_1')=r(D_1)$, puis expliquer la construction.",
    "w": 3,
    "s": "$B\\in(D_1)$ donc $C=r(B)\\in r(D_1)=(D_1')$ ; de plus $C\\in(D_2)$. Ainsi $C$ est l'intersection de $(D_2)$ et $(D_1')$.<br>Construction : on trace $(D_1')$ (image de deux points de $(D_1)$), on obtient $C$, puis $B=r^{-1}(C)$, c'est-à-dire l'image de $C$ par la rotation de centre $A$ et d'angle $-\\dfrac\\pi3$."
   },
   {
    "q": "Le problème a-t-il toujours une solution ?",
    "w": 2,
    "s": "Il y a une solution unique si $(D_1')$ et $(D_2)$ sont sécantes ; aucune si elles sont strictement parallèles ; une infinité si elles sont confondues."
   }
  ]
 },
 {
  "id": "rot-6",
  "chapter": "1bac-math-7",
  "title": "Rotation et angles orientés",
  "questions": [
   {
    "q": "$OAB$ est un triangle isocèle en $O$ avec $(\\overrightarrow{OA},\\overrightarrow{OB})\\equiv\\dfrac{2\\pi}3$. Déterminer l'angle de la rotation $r$ de centre $O$ qui transforme $A$ en $B$.",
    "w": 3,
    "s": "$OA=OB$ et la rotation de centre $O$ transformant $A$ en $B$ a pour angle $(\\overrightarrow{OA},\\overrightarrow{OB})\\equiv\\dfrac{2\\pi}3$."
   },
   {
    "q": "Soit $C=r(B)$. Montrer que $r(C)=A$ et que $ABC$ est équilatéral.",
    "w": 3,
    "s": "$r\\circ r\\circ r$ est une rotation de centre $O$ d'angle $3\\times\\dfrac{2\\pi}3=2\\pi$ : c'est l'identité. Donc $r(C)=r(r(r(A)))=A$.<br>$r$ envoie $A\\to B$, $B\\to C$, $C\\to A$, donc $[AB]\\to[BC]\\to[CA]$ ; une rotation conserve les distances : $AB=BC=CA$."
   },
   {
    "q": "Quel est le centre de gravité du triangle $ABC$ ?",
    "w": 2,
    "s": "$OA=OB=OC$ : $O$ est le centre du cercle circonscrit. Dans un triangle équilatéral, ce point est aussi le centre de gravité : c'est $O$."
   }
  ]
 },
 {
  "id": "lim-1",
  "chapter": "1bac-math-8",
  "title": "Limites de fonctions rationnelles",
  "questions": [
   {
    "q": "Calculer $\\displaystyle\\lim_{x\\to+\\infty}\\dfrac{3x^2-x+1}{2x^2+5}$ et $\\displaystyle\\lim_{x\\to-\\infty}\\dfrac{x^3-1}{x^2+x}$.",
    "w": 3,
    "s": "En l'infini, une fraction rationnelle a la même limite que le quotient de ses termes de plus haut degré.<br>$\\dfrac{3x^2}{2x^2}=\\dfrac32$, donc la première limite vaut $\\dfrac32$.<br>$\\dfrac{x^3}{x^2}=x\\to-\\infty$, donc la deuxième limite vaut $-\\infty$."
   },
   {
    "q": "Calculer $\\displaystyle\\lim_{x\\to2}\\dfrac{x^2-4}{x^2-3x+2}$.",
    "w": 3,
    "s": "Forme $\\dfrac00$ : on factorise par $(x-2)$. $\\dfrac{(x-2)(x+2)}{(x-2)(x-1)}=\\dfrac{x+2}{x-1}\\to\\dfrac41=4$."
   },
   {
    "q": "Calculer $\\displaystyle\\lim_{x\\to1^+}\\dfrac{x+2}{x-1}$ et $\\displaystyle\\lim_{x\\to1^-}\\dfrac{x+2}{x-1}$.",
    "w": 2,
    "s": "Le numérateur tend vers $3\\gt0$. Si $x\\to1^+$, $x-1\\to0^+$ : limite $+\\infty$. Si $x\\to1^-$, $x-1\\to0^-$ : limite $-\\infty$."
   }
  ]
 },
 {
  "id": "lim-2",
  "chapter": "1bac-math-8",
  "title": "Limites avec racines carrées",
  "questions": [
   {
    "q": "Calculer $\\displaystyle\\lim_{x\\to+\\infty}\\left(\\sqrt{x^2+4x}-x\\right)$.",
    "w": 3,
    "s": "Forme $\\infty-\\infty$ : on multiplie par la quantité conjuguée.<br>$\\sqrt{x^2+4x}-x=\\dfrac{x^2+4x-x^2}{\\sqrt{x^2+4x}+x}=\\dfrac{4x}{x\\left(\\sqrt{1+\\frac4x}+1\\right)}=\\dfrac{4}{\\sqrt{1+\\frac4x}+1}\\to\\dfrac42=2$."
   },
   {
    "q": "Calculer $\\displaystyle\\lim_{x\\to9}\\dfrac{\\sqrt x-3}{x-9}$.",
    "w": 3,
    "s": "$x-9=(\\sqrt x-3)(\\sqrt x+3)$, donc $\\dfrac{\\sqrt x-3}{x-9}=\\dfrac1{\\sqrt x+3}\\to\\dfrac16$."
   },
   {
    "q": "Calculer $\\displaystyle\\lim_{x\\to+\\infty}\\dfrac{\\sqrt{x}+1}{x}$.",
    "w": 2,
    "s": "$\\dfrac{\\sqrt x+1}x=\\dfrac1{\\sqrt x}+\\dfrac1x\\to0+0=0$."
   }
  ]
 },
 {
  "id": "lim-3",
  "chapter": "1bac-math-8",
  "title": "Limites trigonométriques",
  "questions": [
   {
    "q": "Calculer $\\displaystyle\\lim_{x\\to0}\\dfrac{\\sin4x}{x}$ et $\\displaystyle\\lim_{x\\to0}\\dfrac{\\tan2x}{\\sin3x}$.",
    "w": 3,
    "s": "$\\dfrac{\\sin4x}x=4\\times\\dfrac{\\sin4x}{4x}\\to4\\times1=4$.<br>$\\dfrac{\\tan2x}{\\sin3x}=\\dfrac{\\tan2x}{2x}\\times\\dfrac{3x}{\\sin3x}\\times\\dfrac23\\to1\\times1\\times\\dfrac23=\\dfrac23$."
   },
   {
    "q": "Calculer $\\displaystyle\\lim_{x\\to0}\\dfrac{1-\\cos2x}{x^2}$.",
    "w": 3,
    "s": "$\\dfrac{1-\\cos2x}{x^2}=4\\times\\dfrac{1-\\cos2x}{(2x)^2}\\to4\\times\\dfrac12=2$ (car $\\dfrac{1-\\cos X}{X^2}\\to\\dfrac12$ quand $X\\to0$)."
   },
   {
    "q": "Calculer $\\displaystyle\\lim_{x\\to\\frac\\pi2}\\dfrac{\\cos x}{x-\\frac\\pi2}$ en posant $X=x-\\dfrac\\pi2$.",
    "w": 2,
    "s": "$\\cos x=\\cos\\left(X+\\dfrac\\pi2\\right)=-\\sin X$, donc $\\dfrac{\\cos x}{x-\\frac\\pi2}=-\\dfrac{\\sin X}X\\to-1$."
   }
  ]
 },
 {
  "id": "lim-4",
  "chapter": "1bac-math-8",
  "title": "Limites et ordre",
  "questions": [
   {
    "q": "Montrer que pour tout $x\\gt0$ : $\\dfrac{x-1}{x}\\le\\dfrac{x+\\cos x}{x}\\le\\dfrac{x+1}x$, puis en déduire $\\displaystyle\\lim_{x\\to+\\infty}\\dfrac{x+\\cos x}x$.",
    "w": 3,
    "s": "$-1\\le\\cos x\\le1$, donc $x-1\\le x+\\cos x\\le x+1$ ; on divise par $x\\gt0$ (le sens ne change pas).<br>$\\dfrac{x-1}x=1-\\dfrac1x\\to1$ et $\\dfrac{x+1}x\\to1$. Par le théorème des gendarmes, la limite vaut $1$."
   },
   {
    "q": "Calculer $\\displaystyle\\lim_{x\\to+\\infty}\\left(x-2\\sin x\\right)$.",
    "w": 3,
    "s": "$-2\\sin x\\ge-2$, donc $x-2\\sin x\\ge x-2$. Comme $x-2\\to+\\infty$, on obtient $\\displaystyle\\lim_{x\\to+\\infty}(x-2\\sin x)=+\\infty$."
   },
   {
    "q": "Calculer $\\displaystyle\\lim_{x\\to0}x\\sin\\dfrac1x$.",
    "w": 2,
    "s": "$\\left|x\\sin\\dfrac1x\\right|\\le|x|$ et $|x|\\to0$ : la limite vaut $0$."
   }
  ]
 },
 {
  "id": "lim-5",
  "chapter": "1bac-math-8",
  "title": "Asymptotes",
  "questions": [
   {
    "q": "Soit $f(x)=\\dfrac{2x+1}{x-3}$. Calculer les limites de $f$ en $+\\infty$, en $-\\infty$ et en $3$ (à droite et à gauche).",
    "w": 3,
    "s": "En $\\pm\\infty$ : $\\dfrac{2x}{x}=2$, donc $\\lim f=2$.<br>En $3$ : le numérateur tend vers $7\\gt0$ ; $x-3\\to0^+$ à droite et $0^-$ à gauche. $\\displaystyle\\lim_{x\\to3^+}f=+\\infty$, $\\displaystyle\\lim_{x\\to3^-}f=-\\infty$."
   },
   {
    "q": "En déduire les asymptotes de la courbe de $f$.",
    "w": 2,
    "s": "La droite $y=2$ est asymptote horizontale en $+\\infty$ et en $-\\infty$ ; la droite $x=3$ est asymptote verticale."
   },
   {
    "q": "Étudier le signe de $f(x)-2$ et en déduire la position de la courbe par rapport à l'asymptote horizontale.",
    "w": 3,
    "s": "$f(x)-2=\\dfrac{2x+1-2(x-3)}{x-3}=\\dfrac7{x-3}$ : positif si $x\\gt3$, négatif si $x\\lt3$.<br>La courbe est au-dessus de $y=2$ sur $]3;+\\infty[$ et au-dessous sur $]-\\infty;3[$."
   }
  ]
 },
 {
  "id": "lim-6",
  "chapter": "1bac-math-8",
  "title": "Limite et paramètre",
  "questions": [
   {
    "q": "Soit $a$ un réel et $f(x)=\\dfrac{x^2+ax-3}{x-1}$. Pour quelle valeur de $a$ le numérateur s'annule-t-il en $1$ ?",
    "w": 3,
    "s": "$1+a-3=0\\iff a=2$."
   },
   {
    "q": "Pour cette valeur, calculer $\\displaystyle\\lim_{x\\to1}f(x)$.",
    "w": 3,
    "s": "$x^2+2x-3=(x-1)(x+3)$, donc $f(x)=x+3$ pour $x\\ne1$ et $\\displaystyle\\lim_{x\\to1}f(x)=4$."
   },
   {
    "q": "Si $a\\ne2$, la limite de $f$ en $1$ peut-elle être finie ?",
    "w": 2,
    "s": "Non : le numérateur tend vers $a-2\\ne0$ et le dénominateur vers $0$, donc $|f(x)|\\to+\\infty$ (limites infinies à droite et à gauche de $1$)."
   }
  ]
 },
 {
  "id": "der-1",
  "chapter": "1bac-math-9",
  "title": "Nombre dérivé et tangente",
  "questions": [
   {
    "q": "Soit $f(x)=x^2+x$. En utilisant la définition, montrer que $f$ est dérivable en $2$ et calculer $f'(2)$.",
    "w": 3,
    "s": "$f(2)=6$. Pour $x\\ne2$ : $\\dfrac{f(x)-f(2)}{x-2}=\\dfrac{x^2+x-6}{x-2}=\\dfrac{(x-2)(x+3)}{x-2}=x+3$.<br>Quand $x\\to2$, ce taux tend vers $5$ (nombre réel) : $f$ est dérivable en $2$ et $f'(2)=5$."
   },
   {
    "q": "Donner une équation de la tangente $(T)$ à la courbe de $f$ au point d'abscisse $2$.",
    "w": 2,
    "s": "$(T):y=f'(2)(x-2)+f(2)=5(x-2)+6$, soit $y=5x-4$."
   },
   {
    "q": "Étudier la dérivabilité en $0$ de $g(x)=x|x|$.",
    "w": 3,
    "s": "$g(0)=0$ et pour $x\\ne0$ : $\\dfrac{g(x)-g(0)}{x}=\\dfrac{x|x|}x=|x|\\to0$.<br>$g$ est dérivable en $0$ et $g'(0)=0$ : la courbe admet une tangente horizontale à l'origine."
   }
  ]
 },
 {
  "id": "der-2",
  "chapter": "1bac-math-9",
  "title": "Calcul de dérivées",
  "questions": [
   {
    "q": "Calculer la dérivée de $f_1(x)=\\dfrac{x^2-1}{x+2}$ sur $]-2;+\\infty[$ et de $f_2(x)=(3x-2)^5$ sur $\\mathbb R$.",
    "w": 3,
    "s": "$f_1=\\dfrac uv$ avec $u=x^2-1$, $v=x+2$ : $f_1'(x)=\\dfrac{2x(x+2)-(x^2-1)}{(x+2)^2}=\\dfrac{x^2+4x+1}{(x+2)^2}$.<br>$f_2=u^5$ avec $u=3x-2$ : $f_2'(x)=5\\times3\\times(3x-2)^4=15(3x-2)^4$."
   },
   {
    "q": "Calculer la dérivée de $f_3(x)=\\sqrt{x^2+1}$ et de $f_4(x)=x^2\\cos x$ sur $\\mathbb R$.",
    "w": 3,
    "s": "$f_3=\\sqrt u$ avec $u=x^2+1\\gt0$ : $f_3'(x)=\\dfrac{u'}{2\\sqrt u}=\\dfrac{2x}{2\\sqrt{x^2+1}}=\\dfrac{x}{\\sqrt{x^2+1}}$.<br>$f_4=uv$ : $f_4'(x)=2x\\cos x+x^2(-\\sin x)=2x\\cos x-x^2\\sin x$."
   },
   {
    "q": "Calculer la dérivée de $f_5(x)=\\tan x-x$ sur $\\left]-\\dfrac\\pi2;\\dfrac\\pi2\\right[$ et en déduire son sens de variation.",
    "w": 2,
    "s": "$f_5'(x)=1+\\tan^2x-1=\\tan^2x\\ge0$, nulle seulement en $0$ : $f_5$ est strictement croissante sur $\\left]-\\dfrac\\pi2;\\dfrac\\pi2\\right[$."
   }
  ]
 },
 {
  "id": "der-3",
  "chapter": "1bac-math-9",
  "title": "Étude des variations et nombre de solutions",
  "questions": [
   {
    "q": "Soit $f(x)=x^3-6x^2+9x+1$. Calculer $f'(x)$ et l'écrire sous forme factorisée.",
    "w": 3,
    "s": "$f'(x)=3x^2-12x+9=3(x^2-4x+3)=3(x-1)(x-3)$."
   },
   {
    "q": "Dresser le tableau de variations de $f$ (limites comprises) et préciser les extremums locaux.",
    "w": 3,
    "s": "$f'(x)\\gt0$ sur $]-\\infty;1[\\cup]3;+\\infty[$ et $f'(x)\\lt0$ sur $]1;3[$. En $\\pm\\infty$, $f(x)$ a la limite de $x^3$ : $-\\infty$ en $-\\infty$, $+\\infty$ en $+\\infty$.<table class='tv'><tr><td>$x$</td><td>$-\\infty$</td><td></td><td>$1$</td><td></td><td>$3$</td><td></td><td>$+\\infty$</td></tr><tr><td>$f'(x)$</td><td></td><td>$+$</td><td>$0$</td><td>$-$</td><td>$0$</td><td>$+$</td><td></td></tr><tr><td>$f$</td><td>$-\\infty$</td><td>↗</td><td>$5$</td><td>↘</td><td>$1$</td><td>↗</td><td>$+\\infty$</td></tr></table>Maximum local $f(1)=5$ ; minimum local $f(3)=1$."
   },
   {
    "q": "Montrer que l'équation $f(x)=0$ admet une unique solution, comprise entre $-1$ et $0$.",
    "w": 2,
    "s": "Sur $[1;+\\infty[$, $f(x)\\ge1\\gt0$ : pas de solution. Sur $]-\\infty;1]$, $f$ est continue et strictement croissante de $-\\infty$ à $5$ : elle s'annule une seule fois.<br>$f(-1)=-15\\lt0$ et $f(0)=1\\gt0$, donc la solution est entre $-1$ et $0$."
   }
  ]
 },
 {
  "id": "der-4",
  "chapter": "1bac-math-9",
  "title": "Tangentes particulières",
  "questions": [
   {
    "q": "Soit $f(x)=x^2-3x$. Déterminer le point de la courbe où la tangente est parallèle à la droite $y=x$, puis l'équation de cette tangente.",
    "w": 3,
    "s": "Tangente parallèle à $y=x$ $\\iff$ coefficient directeur $1$ $\\iff f'(a)=2a-3=1\\iff a=2$.<br>$f(2)=-2$ : point $(2;-2)$ ; tangente $y=1\\times(x-2)-2=x-4$."
   },
   {
    "q": "Déterminer les tangentes à la courbe de $f$ qui passent par l'origine $O$.",
    "w": 3,
    "s": "La tangente au point d'abscisse $a$ : $y=(2a-3)(x-a)+a^2-3a$. Elle passe par $O$ si $0=(2a-3)(-a)+a^2-3a=-a^2$, soit $a=0$.<br>Une seule tangente : celle en $O$, d'équation $y=-3x$."
   },
   {
    "q": "Existe-t-il une tangente horizontale ? Si oui, en quel point ?",
    "w": 2,
    "s": "$f'(a)=0\\iff a=\\dfrac32$ ; $f\\left(\\tfrac32\\right)=\\dfrac94-\\dfrac92=-\\dfrac94$. Tangente horizontale au point $\\left(\\tfrac32;-\\tfrac94\\right)$."
   }
  ]
 },
 {
  "id": "der-5",
  "chapter": "1bac-math-9",
  "title": "Approximation affine et inégalité",
  "questions": [
   {
    "q": "Soit $f(x)=\\sqrt{2x+1}$. Calculer $f(4)$ et $f'(4)$, puis donner l'approximation affine de $f$ au voisinage de $4$.",
    "w": 3,
    "s": "$f(4)=\\sqrt9=3$ ; $f'(x)=\\dfrac{2}{2\\sqrt{2x+1}}=\\dfrac1{\\sqrt{2x+1}}$, donc $f'(4)=\\dfrac13$.<br>Pour $h$ proche de $0$ : $f(4+h)\\approx3+\\dfrac h3$."
   },
   {
    "q": "En déduire une valeur approchée de $\\sqrt{9{,}06}$.",
    "w": 2,
    "s": "$9{,}06=2\\times4{,}03+1$, donc $\\sqrt{9{,}06}=f(4+0{,}03)\\approx3+0{,}01=3{,}01$ (valeur exacte : $3{,}00998\\ldots$)."
   },
   {
    "q": "Soit $g(x)=x-\\sin x$ sur $[0;+\\infty[$. Étudier le sens de variation de $g$ et en déduire que $\\sin x\\le x$ pour tout $x\\ge0$.",
    "w": 3,
    "s": "$g'(x)=1-\\cos x\\ge0$ (car $\\cos x\\le1$) : $g$ est croissante sur $[0;+\\infty[$.<br>Donc pour $x\\ge0$ : $g(x)\\ge g(0)=0$, c'est-à-dire $x-\\sin x\\ge0$, soit $\\sin x\\le x$."
   }
  ]
 },
 {
  "id": "der-6",
  "chapter": "1bac-math-9",
  "title": "Optimisation et équation différentielle",
  "questions": [
   {
    "q": "Un rectangle a un périmètre de $20$ cm. On note $x$ sa largeur ($0\\lt x\\lt10$). Montrer que son aire est $A(x)=x(10-x)$ et déterminer $x$ pour que l'aire soit maximale.",
    "w": 3,
    "s": "Demi-périmètre $10$ : la longueur vaut $10-x$, donc $A(x)=x(10-x)=10x-x^2$.<br>$A'(x)=10-2x$ : positif sur $]0;5[$, négatif sur $]5;10[$. L'aire est maximale pour $x=5$ : $A(5)=25$ cm² (le rectangle est un carré)."
   },
   {
    "q": "Résoudre l'équation différentielle $y''+16y=0$.",
    "w": 2,
    "s": "C'est l'équation $y''+\\omega^2y=0$ avec $\\omega=4$ : les solutions sont $y(x)=\\alpha\\cos4x+\\beta\\sin4x$, $\\alpha,\\beta\\in\\mathbb R$."
   },
   {
    "q": "Déterminer la solution $f$ telle que $f(0)=1$ et $f'(0)=8$.",
    "w": 3,
    "s": "$f(0)=\\alpha=1$. $f'(x)=-4\\alpha\\sin4x+4\\beta\\cos4x$, donc $f'(0)=4\\beta=8$ et $\\beta=2$.<br>$f(x)=\\cos4x+2\\sin4x$."
   }
  ]
 },
 {
  "id": "rg-1",
  "chapter": "1bac-math-10",
  "title": "Asymptote oblique et position",
  "questions": [
   {
    "q": "Soit $f(x)=\\dfrac{x^2-x+2}{x-1}$ sur $\\mathbb R\\setminus\\{1\\}$. Montrer que $f(x)=x+\\dfrac2{x-1}$.",
    "w": 3,
    "s": "$x+\\dfrac2{x-1}=\\dfrac{x(x-1)+2}{x-1}=\\dfrac{x^2-x+2}{x-1}=f(x)$."
   },
   {
    "q": "En déduire les asymptotes de la courbe $(C_f)$ et sa position par rapport à l'asymptote oblique.",
    "w": 3,
    "s": "$\\dfrac2{x-1}\\to0$ en $\\pm\\infty$ : la droite $y=x$ est asymptote oblique en $+\\infty$ et en $-\\infty$.<br>En $1$ : $\\displaystyle\\lim_{x\\to1^+}f=+\\infty$, $\\displaystyle\\lim_{x\\to1^-}f=-\\infty$ : la droite $x=1$ est asymptote verticale.<br>$f(x)-x=\\dfrac2{x-1}$ : $(C_f)$ est au-dessus de $y=x$ sur $]1;+\\infty[$ et au-dessous sur $]-\\infty;1[$."
   },
   {
    "q": "Montrer que le point $\\Omega(1;1)$ est centre de symétrie de $(C_f)$.",
    "w": 2,
    "s": "Si $x\\ne1$ alors $2-x\\ne1$. $f(2-x)=2-x+\\dfrac2{1-x}=2-x-\\dfrac2{x-1}$, donc $f(2-x)+f(x)=2=2\\times1$ : $\\Omega(1;1)$ est centre de symétrie."
   }
  ]
 },
 {
  "id": "rg-2",
  "chapter": "1bac-math-10",
  "title": "Branches infinies",
  "questions": [
   {
    "q": "Étudier la branche infinie en $+\\infty$ de la courbe de $f(x)=\\sqrt{3x}$.",
    "w": 3,
    "s": "$f(x)\\to+\\infty$ et $\\dfrac{f(x)}x=\\dfrac{\\sqrt{3x}}x=\\sqrt{\\dfrac3x}\\to0$ : branche parabolique de direction l'<b>axe des abscisses</b>."
   },
   {
    "q": "Même question pour $g(x)=x^2-\\sqrt x$.",
    "w": 3,
    "s": "$g(x)=x^2\\left(1-\\dfrac1{x\\sqrt x}\\right)\\to+\\infty$ et $\\dfrac{g(x)}x=x-\\dfrac1{\\sqrt x}\\to+\\infty$ : branche parabolique de direction l'<b>axe des ordonnées</b>."
   },
   {
    "q": "Même question pour $h(x)=x-2\\sqrt x$.",
    "w": 2,
    "s": "$h(x)=\\sqrt x(\\sqrt x-2)\\to+\\infty$ ; $\\dfrac{h(x)}x=1-\\dfrac2{\\sqrt x}\\to1$ ; $h(x)-x=-2\\sqrt x\\to-\\infty$ : branche parabolique de direction la <b>droite $y=x$</b>."
   }
  ]
 },
 {
  "id": "rg-3",
  "chapter": "1bac-math-10",
  "title": "Concavité et point d'inflexion",
  "questions": [
   {
    "q": "Soit $f(x)=x^3-3x^2+2$. Calculer $f''(x)$ et étudier la concavité de la courbe.",
    "w": 3,
    "s": "$f'(x)=3x^2-6x$ et $f''(x)=6x-6$.<br>$f''(x)\\lt0$ sur $]-\\infty;1[$ : concavité tournée vers les ordonnées négatives ; $f''(x)\\gt0$ sur $]1;+\\infty[$ : tournée vers les ordonnées positives."
   },
   {
    "q": "Montrer que $I(1;0)$ est un point d'inflexion et donner la tangente en $I$.",
    "w": 3,
    "s": "$f''$ s'annule en $1$ en changeant de signe et $f(1)=1-3+2=0$ : $I(1;0)$ est un point d'inflexion.<br>$f'(1)=-3$ : tangente $y=-3(x-1)=-3x+3$."
   },
   {
    "q": "Montrer que $I$ est centre de symétrie de la courbe.",
    "w": 2,
    "s": "$f(2-x)+f(x)=0$ (on développe : $(2-x)^3-3(2-x)^2+2=-x^3+3x^2-2$). Donc $f(2-x)+f(x)=0=2\\times0$ : $I(1;0)$ est centre de symétrie."
   }
  ]
 },
 {
  "id": "rg-4",
  "chapter": "1bac-math-10",
  "title": "Axe et centre de symétrie",
  "questions": [
   {
    "q": "Montrer que la droite $x=3$ est un axe de symétrie de la courbe de $f(x)=x^2-6x+5$.",
    "w": 3,
    "s": "$D_f=\\mathbb R$. $f(6-x)=(6-x)^2-6(6-x)+5=36-12x+x^2-36+6x+5=x^2-6x+5=f(x)$ : la droite $x=3$ est un axe de symétrie."
   },
   {
    "q": "Soit $g(x)=\\dfrac{3x-1}{x-2}$. Vérifier que $g(x)=3+\\dfrac5{x-2}$ et montrer que $\\Omega(2;3)$ est centre de symétrie de sa courbe.",
    "w": 3,
    "s": "$3+\\dfrac5{x-2}=\\dfrac{3x-6+5}{x-2}=\\dfrac{3x-1}{x-2}$.<br>Pour $x\\ne2$, $4-x\\ne2$ et $g(4-x)=3+\\dfrac5{2-x}=3-\\dfrac5{x-2}$, donc $g(4-x)+g(x)=6=2\\times3$ : $\\Omega(2;3)$ est centre de symétrie."
   },
   {
    "q": "Donner les asymptotes de la courbe de $g$.",
    "w": 2,
    "s": "$\\dfrac5{x-2}\\to0$ en $\\pm\\infty$ : asymptote horizontale $y=3$. En $2$ : limites infinies, asymptote verticale $x=2$. (Leur point d'intersection est le centre $\\Omega$.)"
   }
  ]
 },
 {
  "id": "rg-5",
  "chapter": "1bac-math-10",
  "title": "Étude complète d'une fonction",
  "questions": [
   {
    "q": "Soit $f(x)=x+\\dfrac1x$ sur $\\mathbb R^*$. Étudier la parité de $f$.",
    "w": 2,
    "s": "$\\mathbb R^*$ est symétrique et $f(-x)=-x-\\dfrac1x=-f(x)$ : $f$ est impaire, sa courbe est symétrique par rapport à l'origine."
   },
   {
    "q": "Calculer les limites de $f$ et donner les asymptotes de sa courbe.",
    "w": 3,
    "s": "$\\displaystyle\\lim_{x\\to0^+}f=+\\infty$, $\\displaystyle\\lim_{x\\to0^-}f=-\\infty$ : asymptote verticale $x=0$.<br>$\\displaystyle\\lim_{\\pm\\infty}f=\\pm\\infty$ et $f(x)-x=\\dfrac1x\\to0$ : asymptote oblique $y=x$."
   },
   {
    "q": "Calculer $f'(x)$ et dresser le tableau de variations de $f$.",
    "w": 3,
    "s": "$f'(x)=1-\\dfrac1{x^2}=\\dfrac{(x-1)(x+1)}{x^2}$ : positive sur $]-\\infty;-1[\\cup]1;+\\infty[$, négative sur $]-1;0[\\cup]0;1[$.<br>Maximum local $f(-1)=-2$ ; minimum local $f(1)=2$. $f$ croît sur $]-\\infty;-1]$, décroît sur $[-1;0[$ et sur $]0;1]$, croît sur $[1;+\\infty[$."
   }
  ]
 },
 {
  "id": "rg-6",
  "chapter": "1bac-math-10",
  "title": "Lecture du tableau et nombre de solutions",
  "questions": [
   {
    "q": "Soit $f(x)=x^3-3x$. Dresser le tableau de variations de $f$.",
    "w": 3,
    "s": "$f'(x)=3x^2-3=3(x-1)(x+1)$. $f$ croît sur $]-\\infty;-1]$, décroît sur $[-1;1]$, croît sur $[1;+\\infty[$ ; $f(-1)=2$, $f(1)=-2$ ; limites $-\\infty$ en $-\\infty$ et $+\\infty$ en $+\\infty$."
   },
   {
    "q": "Selon les valeurs du réel $m$, donner le nombre de solutions de l'équation $f(x)=m$.",
    "w": 3,
    "s": "On lit le tableau (droite horizontale $y=m$) :<br>$m\\gt2$ ou $m\\lt-2$ : une solution ; $m=2$ ou $m=-2$ : deux solutions ; $-2\\lt m\\lt2$ : trois solutions."
   },
   {
    "q": "Résoudre l'équation $f(x)=2$.",
    "w": 2,
    "s": "$x^3-3x-2=0$. $x=-1$ est racine double (tangente horizontale) : $x^3-3x-2=(x+1)^2(x-2)$. $S=\\{-1;2\\}$, ce qui confirme les deux solutions pour $m=2$."
   }
  ]
 },
 {
  "id": "ves-1",
  "chapter": "1bac-math-11",
  "title": "Calcul vectoriel dans le cube",
  "questions": [
   {
    "q": "$ABCDEFGH$ est un cube ($ABCD$ et $EFGH$ faces opposées, $E$ au-dessus de $A$). Simplifier $\\vec u=\\overrightarrow{EF}+\\overrightarrow{CG}+\\overrightarrow{DA}$ et $\\vec v=\\overrightarrow{HB}-\\overrightarrow{HD}+\\overrightarrow{CD}$.",
    "w": 3,
    "s": "$\\overrightarrow{EF}=\\overrightarrow{AB}$ et $\\overrightarrow{CG}=\\overrightarrow{BF}$, donc $\\vec u=\\overrightarrow{DA}+\\overrightarrow{AB}+\\overrightarrow{BF}=\\overrightarrow{DF}$.<br>$\\overrightarrow{HB}-\\overrightarrow{HD}=\\overrightarrow{DH}+\\overrightarrow{HB}=\\overrightarrow{DB}$, donc $\\vec v=\\overrightarrow{CD}+\\overrightarrow{DB}=\\overrightarrow{CB}$."
   },
   {
    "q": "Montrer que $\\overrightarrow{AG}=\\overrightarrow{AB}+\\overrightarrow{AD}+\\overrightarrow{AE}$.",
    "w": 3,
    "s": "$\\overrightarrow{AG}=\\overrightarrow{AC}+\\overrightarrow{CG}$ ; $\\overrightarrow{AC}=\\overrightarrow{AB}+\\overrightarrow{AD}$ (règle du parallélogramme dans le carré $ABCD$) et $\\overrightarrow{CG}=\\overrightarrow{AE}$. D'où le résultat."
   },
   {
    "q": "Soit $O$ le milieu de $[AG]$. Montrer que $O$ est aussi le milieu de $[BH]$.",
    "w": 2,
    "s": "Le milieu $O'$ de $[BH]$ vérifie $\\overrightarrow{AO'}=\\dfrac12(\\overrightarrow{AB}+\\overrightarrow{AH})=\\dfrac12(\\overrightarrow{AB}+\\overrightarrow{AD}+\\overrightarrow{AE})=\\dfrac12\\overrightarrow{AG}=\\overrightarrow{AO}$. Donc $O'=O$."
   }
  ]
 },
 {
  "id": "ves-2",
  "chapter": "1bac-math-11",
  "title": "Milieux et plans parallèles",
  "questions": [
   {
    "q": "$ABCD$ est un tétraèdre ; $I$, $J$, $K$ sont les milieux de $[AB]$, $[AC]$, $[AD]$. Montrer que $\\overrightarrow{IJ}=\\dfrac12\\overrightarrow{BC}$ et $\\overrightarrow{IK}=\\dfrac12\\overrightarrow{BD}$.",
    "w": 3,
    "s": "$\\overrightarrow{IJ}=\\overrightarrow{IA}+\\overrightarrow{AJ}=\\dfrac12\\overrightarrow{BA}+\\dfrac12\\overrightarrow{AC}=\\dfrac12\\overrightarrow{BC}$. De même $\\overrightarrow{IK}=\\dfrac12\\overrightarrow{BA}+\\dfrac12\\overrightarrow{AD}=\\dfrac12\\overrightarrow{BD}$."
   },
   {
    "q": "En déduire que les plans $(IJK)$ et $(BCD)$ sont parallèles.",
    "w": 3,
    "s": "$(IJK)$ est dirigé par $\\overrightarrow{IJ}$ et $\\overrightarrow{IK}$, colinéaires respectivement à $\\overrightarrow{BC}$ et $\\overrightarrow{BD}$ qui dirigent $(BCD)$. Deux plans dirigés par les mêmes couples de vecteurs sont parallèles."
   },
   {
    "q": "Les plans $(IJK)$ et $(BCD)$ sont-ils confondus ?",
    "w": 2,
    "s": "Non : $I$ est sur $[AB]$ avec $I\\ne B$, donc $I\\notin(BCD)$ (sinon $A$ serait dans $(BCD)$). Les plans sont strictement parallèles."
   }
  ]
 },
 {
  "id": "ves-3",
  "chapter": "1bac-math-11",
  "title": "Points alignés",
  "questions": [
   {
    "q": "$ABCD$ est un tétraèdre et $E$ le point tel que $\\overrightarrow{AE}=2\\overrightarrow{AB}-\\overrightarrow{AC}$. Montrer que $\\overrightarrow{BE}=\\overrightarrow{CB}$ et conclure.",
    "w": 3,
    "s": "$\\overrightarrow{BE}=\\overrightarrow{AE}-\\overrightarrow{AB}=\\overrightarrow{AB}-\\overrightarrow{AC}=\\overrightarrow{CB}$.<br>Donc $B$, $C$, $E$ sont alignés et $B$ est le milieu de $[CE]$."
   },
   {
    "q": "Soit $F$ tel que $\\overrightarrow{DF}=\\dfrac23\\overrightarrow{DB}$. Exprimer $\\overrightarrow{AF}$ en fonction de $\\overrightarrow{AB}$ et $\\overrightarrow{AD}$.",
    "w": 3,
    "s": "$\\overrightarrow{AF}=\\overrightarrow{AD}+\\overrightarrow{DF}=\\overrightarrow{AD}+\\dfrac23(\\overrightarrow{AB}-\\overrightarrow{AD})=\\dfrac23\\overrightarrow{AB}+\\dfrac13\\overrightarrow{AD}$."
   },
   {
    "q": "Les points $C$, $E$, $F$ sont-ils alignés ? Justifier.",
    "w": 2,
    "s": "$C$ et $E$ sont sur la droite $(BC)$, contenue dans le plan $(ABC)$. Si $F$ était sur $(CE)$, on aurait $F\\in(ABC)$ ; or $\\overrightarrow{AF}=\\dfrac23\\overrightarrow{AB}+\\dfrac13\\overrightarrow{AD}$ donnerait $\\overrightarrow{AD}$ combinaison de $\\overrightarrow{AB}$ et $\\overrightarrow{AC}$, donc $D\\in(ABC)$ : impossible. Les points ne sont pas alignés."
   }
  ]
 },
 {
  "id": "ves-4",
  "chapter": "1bac-math-11",
  "title": "Appartenance à un plan",
  "questions": [
   {
    "q": "$ABCD$ est un tétraèdre et $M$ le point tel que $\\overrightarrow{AM}=\\overrightarrow{AB}+\\overrightarrow{AC}-\\overrightarrow{AD}$. Montrer que $\\overrightarrow{BM}=\\overrightarrow{DC}$.",
    "w": 3,
    "s": "$\\overrightarrow{BM}=\\overrightarrow{AM}-\\overrightarrow{AB}=\\overrightarrow{AC}-\\overrightarrow{AD}=\\overrightarrow{DC}$."
   },
   {
    "q": "En déduire que $M\\in(BCD)$ et préciser la nature du quadrilatère $BMCD$.",
    "w": 3,
    "s": "$\\overrightarrow{BM}=\\overrightarrow{DC}=\\overrightarrow{BC}-\\overrightarrow{BD}$ est combinaison de $\\overrightarrow{BC}$ et $\\overrightarrow{BD}$, donc $M\\in P(B;\\overrightarrow{BC};\\overrightarrow{BD})=(BCD)$.<br>$\\overrightarrow{BM}=\\overrightarrow{DC}$ : $BMCD$ est un parallélogramme."
   },
   {
    "q": "Soit $N$ tel que $\\overrightarrow{AN}=\\dfrac12\\overrightarrow{AB}+\\dfrac12\\overrightarrow{AC}+\\overrightarrow{AD}$. Montrer par l'absurde que $N\\notin(ABC)$.",
    "w": 2,
    "s": "Si $N\\in(ABC)$, $\\overrightarrow{AN}=x\\overrightarrow{AB}+y\\overrightarrow{AC}$, et alors $\\overrightarrow{AD}=\\left(x-\\tfrac12\\right)\\overrightarrow{AB}+\\left(y-\\tfrac12\\right)\\overrightarrow{AC}$ : $D\\in(ABC)$, ce qui est impossible pour un tétraèdre."
   }
  ]
 },
 {
  "id": "ves-5",
  "chapter": "1bac-math-11",
  "title": "Quatre milieux coplanaires",
  "questions": [
   {
    "q": "$ABCD$ est un tétraèdre ; $I$, $J$, $K$, $L$ sont les milieux respectifs de $[AB]$, $[CD]$, $[AD]$ et $[BC]$. Montrer que $\\overrightarrow{IK}=\\dfrac12\\overrightarrow{BD}$ et $\\overrightarrow{LJ}=\\dfrac12\\overrightarrow{BD}$.",
    "w": 3,
    "s": "Théorème des milieux (par Chasles) : dans le triangle $ABD$, $\\overrightarrow{IK}=\\overrightarrow{IA}+\\overrightarrow{AK}=\\dfrac12\\overrightarrow{BA}+\\dfrac12\\overrightarrow{AD}=\\dfrac12\\overrightarrow{BD}$.<br>Dans le triangle $BCD$ : $\\overrightarrow{LJ}=\\overrightarrow{LC}+\\overrightarrow{CJ}=\\dfrac12\\overrightarrow{BC}+\\dfrac12\\overrightarrow{CD}=\\dfrac12\\overrightarrow{BD}$."
   },
   {
    "q": "En déduire que $IKJL$ est un parallélogramme, puis que $I$, $J$, $K$, $L$ sont coplanaires.",
    "w": 3,
    "s": "$\\overrightarrow{IK}=\\overrightarrow{LJ}$ : le quadrilatère $IKJL$ est un parallélogramme. Un parallélogramme est une figure plane : $I$, $J$, $K$, $L$ sont coplanaires."
   },
   {
    "q": "Montrer que les segments $[IJ]$ et $[KL]$ ont le même milieu.",
    "w": 2,
    "s": "Les diagonales d'un parallélogramme se coupent en leur milieu : $[IJ]$ et $[KL]$, diagonales de $IKJL$, ont le même milieu."
   }
  ]
 },
 {
  "id": "ves-6",
  "chapter": "1bac-math-11",
  "title": "Vecteurs non coplanaires",
  "questions": [
   {
    "q": "Dans le cube $ABCDEFGH$, justifier que $\\overrightarrow{AB}$, $\\overrightarrow{AD}$ et $\\overrightarrow{AE}$ ne sont pas coplanaires.",
    "w": 2,
    "s": "$A$, $B$, $D$ sont dans le plan de la face $ABCD$ et $E$ n'appartient pas à ce plan : les quatre points $A$, $B$, $D$, $E$ ne sont pas coplanaires, donc les trois vecteurs ne le sont pas."
   },
   {
    "q": "Exprimer $\\overrightarrow{AG}$, $\\overrightarrow{BH}$ et $\\overrightarrow{EC}$ en fonction de $\\overrightarrow{AB}$, $\\overrightarrow{AD}$ et $\\overrightarrow{AE}$.",
    "w": 3,
    "s": "$\\overrightarrow{AG}=\\overrightarrow{AB}+\\overrightarrow{AD}+\\overrightarrow{AE}$.<br>$\\overrightarrow{BH}=\\overrightarrow{BA}+\\overrightarrow{AH}=-\\overrightarrow{AB}+\\overrightarrow{AD}+\\overrightarrow{AE}$.<br>$\\overrightarrow{EC}=\\overrightarrow{EA}+\\overrightarrow{AC}=\\overrightarrow{AB}+\\overrightarrow{AD}-\\overrightarrow{AE}$."
   },
   {
    "q": "Montrer que $\\overrightarrow{AG}$, $\\overrightarrow{BH}$ et $\\overrightarrow{EC}$ ne sont pas coplanaires.",
    "w": 3,
    "s": "$\\overrightarrow{AG}$ et $\\overrightarrow{BH}$ ne sont pas colinéaires. Supposons $\\overrightarrow{EC}=x\\overrightarrow{AG}+y\\overrightarrow{BH}$. En identifiant les coefficients (la décomposition est unique) : $x-y=1$, $x+y=1$ et $x+y=-1$. Les deux dernières équations sont contradictoires : les trois vecteurs ne sont pas coplanaires."
   }
  ]
 },
 {
  "id": "gae-1",
  "chapter": "1bac-math-12",
  "title": "Coordonnées dans l'espace",
  "questions": [
   {
    "q": "Dans un repère, $A(1;2;-1)$, $B(3;0;1)$ et $C(0;1;2)$. Calculer $\\overrightarrow{AB}$, $\\overrightarrow{AC}$ et montrer que $A$, $B$, $C$ ne sont pas alignés.",
    "w": 3,
    "s": "$\\overrightarrow{AB}(2;-2;2)$ et $\\overrightarrow{AC}(-1;-1;3)$.<br>Déterminant extrait : $\\begin{vmatrix}2&-1\\\\-2&-1\\end{vmatrix}=-2-2=-4\\ne0$ : les vecteurs ne sont pas colinéaires, les points ne sont pas alignés."
   },
   {
    "q": "Déterminer les coordonnées du point $D$ tel que $ABCD$ soit un parallélogramme.",
    "w": 3,
    "s": "$ABCD$ parallélogramme $\\iff\\overrightarrow{AD}=\\overrightarrow{BC}$. $\\overrightarrow{BC}(-3;1;1)$, donc $D(1-3;2+1;-1+1)=D(-2;3;0)$."
   },
   {
    "q": "Calculer les coordonnées du centre de gravité $G$ du triangle $ABC$.",
    "w": 2,
    "s": "$G\\left(\\dfrac{1+3+0}3;\\dfrac{2+0+1}3;\\dfrac{-1+1+2}3\\right)=G\\left(\\dfrac43;1;\\dfrac23\\right)$."
   }
  ]
 },
 {
  "id": "gae-2",
  "chapter": "1bac-math-12",
  "title": "Déterminant et coplanarité",
  "questions": [
   {
    "q": "Soit $m$ un réel, $\\vec u(1;1;m)$, $\\vec v(m;1;0)$ et $\\vec w(1;0;1)$. Calculer $\\det(\\vec u,\\vec v,\\vec w)$.",
    "w": 3,
    "s": "$\\det(\\vec u,\\vec v,\\vec w)=\\begin{vmatrix}1&m&1\\\\1&1&0\\\\m&0&1\\end{vmatrix}=1(1\\times1-0)-1(m\\times1-0)+m(m\\times0-1\\times1)$.<br>$=1-m-m=1-2m$."
   },
   {
    "q": "Pour quelle valeur de $m$ les vecteurs sont-ils coplanaires ?",
    "w": 2,
    "s": "$1-2m=0\\iff m=\\dfrac12$."
   },
   {
    "q": "Pour $m=0$, les points $O$, $P(1;1;0)$, $Q(0;1;0)$, $R(1;0;1)$ sont-ils coplanaires ?",
    "w": 3,
    "s": "$\\overrightarrow{OP}=\\vec u$, $\\overrightarrow{OQ}=\\vec v$, $\\overrightarrow{OR}=\\vec w$ pour $m=0$, et $\\det=1\\ne0$ : les vecteurs ne sont pas coplanaires, donc les quatre points ne sont pas coplanaires."
   }
  ]
 },
 {
  "id": "gae-3",
  "chapter": "1bac-math-12",
  "title": "Représentations paramétriques de droites",
  "questions": [
   {
    "q": "Donner une représentation paramétrique de la droite $(D)$ passant par $A(1;0;2)$ et de vecteur directeur $\\vec u(1;2;-1)$.",
    "w": 2,
    "s": "$(D):x=1+t,\\ y=2t,\\ z=2-t\\quad(t\\in\\mathbb R)$."
   },
   {
    "q": "Étudier la position de $(D)$ et de $(\\Delta):x=s,\\ y=s,\\ z=-1+s\\ (s\\in\\mathbb R)$.",
    "w": 3,
    "s": "Vecteurs directeurs $(1;2;-1)$ et $(1;1;1)$ : non colinéaires ($\\begin{vmatrix}1&1\\\\2&1\\end{vmatrix}=-1\\ne0$).<br>Système : $1+t=s$, $2t=s$, $2-t=-1+s$. Les deux premières donnent $t=1$, $s=2$ ; la troisième : $2-1=-1+2$, vraie.<br>Les droites sont <b>sécantes</b> au point $(2;2;1)$."
   },
   {
    "q": "Étudier la position de $(D)$ et de $(\\Delta'):x=3+k,\\ y=1+k,\\ z=1+2k\\ (k\\in\\mathbb R)$.",
    "w": 3,
    "s": "Vecteurs directeurs $(1;2;-1)$ et $(1;1;2)$ non colinéaires. Système : $1+t=3+k$, $2t=1+k$, $2-t=1+2k$. Les deux premières donnent $t=-1$, $k=-3$ ; la troisième : $3=-5$, fausse.<br>Pas de point commun et directions différentes : les droites sont <b>non coplanaires</b>."
   }
  ]
 },
 {
  "id": "gae-4",
  "chapter": "1bac-math-12",
  "title": "Équation cartésienne d'un plan",
  "questions": [
   {
    "q": "Soient $A(2;0;1)$, $B(0;1;3)$ et $C(1;-1;0)$. Montrer que $A$, $B$, $C$ définissent un plan.",
    "w": 3,
    "s": "$\\overrightarrow{AB}(-2;1;2)$ et $\\overrightarrow{AC}(-1;-1;-1)$ ; $\\begin{vmatrix}-2&-1\\\\1&-1\\end{vmatrix}=2+1=3\\ne0$ : non colinéaires, donc $A$, $B$, $C$ ne sont pas alignés et définissent un plan."
   },
   {
    "q": "Montrer qu'une équation cartésienne du plan $(ABC)$ est $x-4y+3z-5=0$.",
    "w": 3,
    "s": "$M(x;y;z)\\in(ABC)\\iff\\det(\\overrightarrow{AM},\\overrightarrow{AB},\\overrightarrow{AC})=0$ :<br>$\\begin{vmatrix}x-2&-2&-1\\\\y&1&-1\\\\z-1&2&-1\\end{vmatrix}=(x-2)(-1+2)-y(2+2)+(z-1)(2+1)=x-4y+3z-5$.<br>(Vérification : $A$ : $2-0+3-5=0$ ; $B$ : $0-4+9-5=0$ ; $C$ : $1+4+0-5=0$.)"
   },
   {
    "q": "Le point $E(5;0;0)$ appartient-il au plan $(ABC)$ ? Et le point $F(0;0;1)$ ?",
    "w": 2,
    "s": "$E$ : $5-0+0-5=0$, donc $E\\in(ABC)$. $F$ : $0-0+3-5=-2\\ne0$, donc $F\\notin(ABC)$."
   }
  ]
 },
 {
  "id": "gae-5",
  "chapter": "1bac-math-12",
  "title": "Droite et plan",
  "questions": [
   {
    "q": "Soit $(P):2x+y-z-1=0$ et $(D)$ la droite d'équations $\\dfrac{x-1}2=\\dfrac{y+1}{-1}=\\dfrac z3$. Donner une représentation paramétrique de $(D)$.",
    "w": 3,
    "s": "On pose la valeur commune égale à $t$ : $x=1+2t$, $y=-1-t$, $z=3t$ $(t\\in\\mathbb R)$. $(D)$ passe par $(1;-1;0)$ et est dirigée par $\\vec u(2;-1;3)$."
   },
   {
    "q": "Étudier la position de $(D)$ et de $(P)$.",
    "w": 3,
    "s": "On remplace : $2(1+2t)+(-1-t)-3t-1=2+4t-1-t-3t-1=0$. L'égalité est vraie pour tout $t$ : tous les points de $(D)$ sont dans $(P)$. La droite $(D)$ est <b>incluse</b> dans $(P)$."
   },
   {
    "q": "Déterminer l'intersection de $(P)$ avec la droite $(D'):x=t,\\ y=1+t,\\ z=2t$.",
    "w": 2,
    "s": "$2t+(1+t)-2t-1=t=0$ : une seule solution $t=0$. $(D')$ coupe $(P)$ au point $(0;1;0)$."
   }
  ]
 },
 {
  "id": "gae-6",
  "chapter": "1bac-math-12",
  "title": "Intersection de deux plans",
  "questions": [
   {
    "q": "Soient $(P):x+2y-z-3=0$ et $(Q):2x-y+z-1=0$. Montrer que $(P)$ et $(Q)$ sont sécants.",
    "w": 2,
    "s": "Les triplets de coefficients $(1;2;-1)$ et $(2;-1;1)$ ne sont pas proportionnels ($\\dfrac21\\ne\\dfrac{-1}2$) : les plans ne sont pas parallèles, ils sont sécants suivant une droite."
   },
   {
    "q": "Montrer que leur droite d'intersection $(\\Delta)$ a pour représentation paramétrique $x=1-t$, $y=1+3t$, $z=5t$ $(t\\in\\mathbb R)$.",
    "w": 4,
    "s": "On vérifie que ces points sont dans les deux plans :<br>$(P)$ : $(1-t)+2(1+3t)-5t-3=1-t+2+6t-5t-3=0$ ✓.<br>$(Q)$ : $2(1-t)-(1+3t)+5t-1=2-2t-1-3t+5t-1=0$ ✓.<br>Ces points forment une droite (vecteur directeur $(-1;3;5)$ non nul) contenue dans $(P)$ et dans $(Q)$ : c'est $(\\Delta)$."
   },
   {
    "q": "Le point $K(0;4;5)$ appartient-il à $(\\Delta)$ ?",
    "w": 2,
    "s": "$x=1-t=0$ donne $t=1$ ; alors $y=4$ et $z=5$ : oui, $K\\in(\\Delta)$."
   }
  ]
 }
];
