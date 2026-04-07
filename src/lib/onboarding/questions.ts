// Type definitions for question structure

export type FollowUp = {
  q: string         // Question text
  multi: boolean    // Multi-select or single?
  opts: string[]    // Option texts
  // dd2 maps a parent option index → a sub-question.
  // Only used for SINGLE-select dd1 (per HTML behavior). Multi-select dd1 never has dd2.
  dd2?: Record<number, FollowUp>
}

export type ClickOption = {
  t: string             // Main option text
  dd1?: FollowUp        // First adaptive follow-up
  dd1then?: FollowUp    // Sequential follow-up after dd1 (alternative to dd2)
  always?: FollowUp     // Always-asked final question
}

export type ClickQuestion = {
  id: number
  type: 'click'
  title: string
  sub: string
  opts: ClickOption[]
}

export type WriteQuestion = {
  id: number
  type: 'write'
  title: string
  sub: string
  aiExamples?: string[]
  followUp?: {
    q: string
    aiExamples?: string[]
  }
}

export type CharacterQuestion = {
  id: number
  type: 'character'
  title: string
  sub: string
}

export type Question = ClickQuestion | WriteQuestion | CharacterQuestion

// ============================================================
// THE 7 QUESTIONS — verbatim Swedish text from the HTML form
// ============================================================

export const QUESTIONS: Question[] = [
  // ----- Q1: Customer communication -----
  {
    id: 1,
    type: 'click',
    title: 'Hur upplever du arbetet med att svara kunder och hantera inkommande meddelanden?',
    sub: 'Välj det som stämmer bäst',
    opts: [
      {
        t: 'Det tar för mycket tid',
        dd1: {
          q: 'Vad tar mest tid?',
          multi: false,
          opts: [
            'Svara på samma typ av frågor om och om igen',
            'Varje kund behöver ett personligt svar',
            'Det är för många meddelanden att hinna med',
            'Jag svarar på flera olika ställen — Instagram, SMS, mejl, samtal',
          ],
          dd2: {
            0: {
              q: 'Vad är de vanligaste frågorna?',
              multi: true,
              opts: [
                'Hur fungerar behandlingen?',
                'Vad får man för resultat och hur många gånger behöver jag gå?',
                'Hur mycket kostar behandlingen?',
                'Kan jag göra behandlingen om jag har detta?',
                'Annat',
              ],
            },
            1: {
              q: 'Vad gör det svårt?',
              multi: true,
              opts: [
                'Det tar tid att formulera sig rätt',
                'Jag vill inte låta generisk',
                'Vissa kunder kräver mer uppmärksamhet än andra',
                'Jag vet inte alltid vad jag ska säga',
              ],
            },
            2: {
              q: 'När är det som värst?',
              multi: true,
              opts: [
                'Under behandlingar — jag kan inte svara men vet att de samlas',
                'På kvällar och helger — jag vill vara ledig men känner press',
                'Hela tiden — det slutar aldrig',
                'På morgonen — jag vaknar till en full inkorg',
              ],
            },
            3: {
              q: 'Var kommer det mest?',
              multi: true,
              opts: ['Instagram DM', 'SMS', 'Samtal', 'Mejl', 'Andra plattformar'],
            },
          },
        },
        always: {
          q: 'Ungefär hur många meddelanden/samtal får du per dag?',
          multi: false,
          opts: ['1–5', '5–10', '10–20', '20+'],
        },
      },
      {
        t: 'Jag vet inte alltid vad jag ska svara',
        dd1: {
          q: 'Vad brukar vara svårast?',
          multi: true,
          opts: [
            'Prisfrågor och förhandling',
            'Kunder som är missnöjda eller klagar',
            'Frågor om behandlingar för att folk har svårt att förstå',
            'Kunder som vill ha råd om vilken behandling de ska välja',
            'Svåra situationer — kunder som blivit besvikna på resultat',
          ],
        },
        always: {
          q: 'Ungefär hur många meddelanden/samtal får du per dag?',
          multi: false,
          opts: ['1–5', '5–10', '10–20', '20+'],
        },
      },
      {
        t: 'Kunderna förväntar sig snabba svar och jag hinner inte',
        dd1: {
          q: 'När blir du mest stressad?',
          multi: true,
          opts: [
            'Under behandlingar — jag kan inte svara men vet att meddelanden samlas',
            'På kvällar och helger — jag vill vara ledig men känner press att svara',
            'Hela tiden — det slutar aldrig',
            'På morgonen — jag vaknar till en full inkorg',
            'Andra situationer',
          ],
        },
        always: {
          q: 'Ungefär hur många meddelanden/samtal får du per dag?',
          multi: false,
          opts: ['1–5', '5–10', '10–20', '20+'],
        },
      },
      {
        t: 'Det funkar bra för mig',
        dd1: {
          q: 'Vad gör att det funkar?',
          multi: false,
          opts: [
            'Jag har bra rutiner',
            'Jag har någon som hjälper mig',
            'Jag har inte så många meddelanden',
            'Jag svarar snabbt och tycker att det är enkelt',
          ],
        },
      },
    ],
  },

  // ----- Q2: Social media -----
  {
    id: 2,
    type: 'click',
    title: 'Hur funkar sociala medier för din klinik i dag?',
    sub: 'Välj det som stämmer bäst',
    opts: [
      {
        t: 'Jag vet inte vad jag ska posta',
        dd1: {
          q: 'Vad känns svårast?',
          multi: true,
          opts: [
            'Komma på idéer till inlägg',
            'Veta vad som faktiskt ger resultat',
            'Hitta en röd tråd i mitt content',
            'Veta vad mina följare vill se',
          ],
        },
        always: {
          q: 'Hur ofta postar du i dag?',
          multi: false,
          opts: [
            'Nästan aldrig',
            'Någon gång i månaden',
            'Någon gång i veckan',
            'Flera gånger i veckan men det känns random',
          ],
        },
      },
      {
        t: 'Jag har inte tid att skapa content',
        dd1: {
          q: 'Vad hade hjälpt dig mest?',
          multi: true,
          opts: [
            'Färdiga texter jag bara kan posta',
            'Påminnelser om att det är dags att posta',
            'Idéer på vad jag ska posta',
            'Någon som sköter mina sociala medier',
          ],
        },
        always: {
          q: 'Hur ofta postar du i dag?',
          multi: false,
          opts: [
            'Nästan aldrig',
            'Någon gång i månaden',
            'Någon gång i veckan',
            'Flera gånger i veckan men det känns random',
          ],
        },
      },
      {
        t: 'Jag tar bilder men de blir aldrig postade',
        dd1: {
          q: 'Var hamnar bilderna?',
          multi: true,
          opts: [
            'I kamerarullen och dör där',
            'Jag sparar dem i en mapp men hinner aldrig posta',
            'I kamerarullen för att jag inte vet vilken jag ska välja',
            'I kamerarullen för att jag inte vet vad jag ska skriva för text till',
            'Annat',
          ],
        },
        always: {
          q: 'Hur ofta postar du i dag?',
          multi: false,
          opts: [
            'Nästan aldrig',
            'Någon gång i månaden',
            'Någon gång i veckan',
            'Flera gånger i veckan men det känns random',
          ],
        },
      },
      {
        t: 'Jag vet inte hur jag ska skriva texter som funkar',
        dd1: {
          q: 'Vad känns svårast?',
          multi: true,
          opts: [
            'Hitta rätt ton — professionell men personlig',
            'Skriva något som faktiskt får folk att engagera sig',
            'Veta vilka hashtags och format som funkar',
            'Det tar för lång tid att formulera sig',
          ],
        },
        always: {
          q: 'Hur ofta postar du i dag?',
          multi: false,
          opts: [
            'Nästan aldrig',
            'Någon gång i månaden',
            'Någon gång i veckan',
            'Flera gånger i veckan men det känns random',
          ],
        },
      },
      {
        t: 'Det funkar bra — jag postar regelbundet',
        dd1: {
          q: 'Vad funkar bäst för dig?',
          multi: false,
          opts: [
            'Före-/efterbilder',
            'Personligt content om mig och kliniken',
            'Tips och utbildande content',
            'Erbjudanden och kampanjer',
            'Reels och video',
          ],
        },
        always: {
          q: 'Hur ofta postar du i dag?',
          multi: false,
          opts: [
            '1 inlägg i veckan',
            '1–3 inlägg i veckan',
            '3–5 inlägg i veckan',
            'Varje dag',
          ],
        },
      },
    ],
  },

  // ----- Q3: Clinic vision (write) -----
  {
    id: 3,
    type: 'write',
    title: 'Om du skulle beskriva vad din klinik står för i en mening — vad hade det varit?',
    sub: '',
    aiExamples: [
      'Vi vill att varje kund ska lämna oss med mer självförtroende',
      'Kvalitet före kvantitet — vi tar hellre färre kunder och gör det perfekt',
      'En trygg plats där du kan vara dig själv',
    ],
    followUp: {
      q: 'Vad är du mest stolt över med din klinik?',
      aiExamples: [
        'Att jag inrett varje rum så att kunden ska känna sig som hemma',
        'Att vi aldrig stressar — varje kund får all uppmärksamhet den förtjänar',
        'Att alla kunder går ut med ett leende på läpparna',
        'Att vi skräddarsyr en personlig plan för varje kund',
      ],
    },
  },

  // ----- Q4: Customer situation -----
  {
    id: 4,
    type: 'click',
    title: 'Hur ser din kundsituation ut i dag?',
    sub: 'Välj det som stämmer bäst',
    opts: [
      {
        t: 'Jag behöver fler nya kunder',
        dd1: {
          q: 'Vad har du testat hittills?',
          multi: false,
          opts: [
            'Annonser på Facebook och Instagram',
            'En kombination av annonser och referenser',
            'Jag får kunder via mitt bokningssystem',
            'Jag har fått alla mina kunder från referenser',
            'Annat',
          ],
          dd2: {
            0: {
              q: 'Hur har det gått?',
              multi: true,
              opts: [
                'Bra — det ger kunder men jag vill ha fler',
                'Det ger kunder men jag vet inte om det är lönsamt',
                'Dåligt — jag lägger pengar men ser inte resultat',
                'Jag har testat men slutade för att jag inte förstod det tillräckligt',
              ],
            },
            1: {
              q: 'Vad funkar bäst av de två?',
              multi: true,
              opts: [
                'Referenser ger bäst kunder men annonser ger volym',
                'Annonserna funkar bäst — referenserna kommer oregelbundet',
                'Båda funkar okej men jag vill ha mer av allt',
                'Svårt att säga — jag har ingen koll på vad som ger vad',
              ],
            },
            2: {
              q: 'Hur nöjd är du med det?',
              multi: true,
              opts: [
                'Det funkar okej men jag vill inte vara beroende av dem',
                'Det ger kunder men kostar för mycket',
                'Det ger för få kunder',
                'Jag vill ha egna kunder som kommer direkt till mig',
              ],
            },
            3: {
              q: 'Hur funkar det?',
              multi: true,
              opts: [
                'Bra men det räcker inte längre — jag vill växa mer',
                'Det funkar men är väldigt oregelbundet',
                'Jag önskar att fler kunder rekommenderade mig',
                'Det ger bra kunder men jag har ingen kontroll över det',
              ],
            },
          },
        },
        always: {
          q: 'Ungefär hur många av dina kunder kommer tillbaka och bokar igen?',
          multi: false,
          opts: [
            'Nästan alla — jag har lojala kunder',
            'Ungefär hälften',
            'Ganska få — de flesta kommer bara en gång',
            'Jag har ingen aning',
          ],
        },
      },
      {
        t: 'Jag vill att fler kunder kommer tillbaka',
        dd1: {
          q: 'Vad gör du i dag för att få kunder att komma tillbaka?',
          multi: false,
          opts: [
            'Jag skickar ibland meddelanden till gamla kunder',
            'Jag förlitar mig på att de bokar själva',
            'Jag gör ingenting — vet inte hur',
            'Jag kör erbjudanden och kampanjer',
          ],
          dd2: {
            0: {
              q: 'Hur funkar det?',
              multi: true,
              opts: [
                'Bra när jag väl gör det men jag gör det för sällan',
                'Blandat — vissa svarar, många ignorerar',
                'Jag vet inte riktigt vad jag ska skriva',
                'Det känns jobbigt och säljigt att höra av sig',
              ],
            },
            1: {
              q: 'Varför?',
              multi: true,
              opts: [
                'Jag vill inte vara påträngande',
                'Jag har inte tid att följa upp',
                'Jag vet inte vad jag ska säga',
                'Jag tänker att bra kunder kommer tillbaka ändå',
              ],
            },
            2: {
              q: 'Vad hade du velat kunna göra?',
              multi: true,
              opts: [
                'Skicka personliga meddelanden som inte känns säljiga',
                'Ha koll på vilka kunder som inte bokat om sig',
                'Automatiskt påminna kunder när det är dags',
                'Veta varför kunder slutar komma',
              ],
            },
            3: {
              q: 'Hur funkar det?',
              multi: true,
              opts: [
                'Det ger tillfälliga bokningar men de kommer inte tillbaka till fullpris',
                'Det funkar bra — folk gillar deals',
                'Det känns som att jag sänker mitt värde',
                'Jag vet inte om det är lönsamt',
              ],
            },
          },
        },
        always: {
          q: 'Ungefär hur många av dina kunder kommer tillbaka och bokar igen?',
          multi: false,
          opts: [
            'Nästan alla — jag har lojala kunder',
            'Ungefär hälften',
            'Ganska få — de flesta kommer bara en gång',
            'Jag har ingen aning',
          ],
        },
      },
    ],
  },

  // ----- Q5: Cancellations -----
  {
    id: 5,
    type: 'click',
    title: 'Hur ser det ut med avbokningar på din klinik?',
    sub: 'Välj det som stämmer bäst',
    opts: [
      {
        t: 'Det händer ofta och det är ett stort problem',
        dd1: {
          q: 'Vad händer mest?',
          multi: true,
          opts: [
            'Kunder avbokar samma dag',
            'Kunder dyker inte upp alls utan att säga något',
            'Kunder avbokar och bokar om flera gånger',
            'Kunder avbokar med kort varsel och jag hinner inte fylla luckan',
          ],
        },
        dd1then: {
          q: 'Vad gör du i dag när det händer?',
          multi: true,
          opts: [
            'Ingenting — jag accepterar det',
            'Jag försöker fylla luckan genom att kontakta andra kunder',
            'Jag postar på Instagram att det finns lediga tider',
            'Jag tar ut en avbokningsavgift',
            'Jag blir frustrerad men gör inget åt det',
            'Ingenting, jag varken hinner eller vill lägga energi på dessa kunder',
          ],
        },
      },
      {
        t: 'Det händer ibland men jag hanterar det',
        dd1: {
          q: 'Hur hanterar du det?',
          multi: true,
          opts: [
            'Jag kontaktar andra kunder och fyller luckan',
            'Jag har en väntelista som jag kontaktar',
            'Jag tar ut en avbokningsavgift',
            'Jag accepterar det och går vidare',
          ],
        },
      },
      {
        t: 'Det händer sällan',
        dd1: {
          q: 'Vad tror du gör att det funkar?',
          multi: false,
          opts: [
            'Jag har lojala kunder som respekterar tider',
            'Jag tar förskottsbetalning eller avbokningsavgift',
            'Jag påminner kunder innan',
            'Vet inte egentligen — men det är inte ett problem för mig',
          ],
        },
      },
      {
        t: 'Det är mitt största problem just nu',
        dd1: {
          q: 'Hur påverkar det dig?',
          multi: true,
          opts: [
            'Jag förlorar pengar varje vecka',
            'Det förstör mitt schema och skapar stress',
            'Jag vet inte hur jag ska lösa det',
            'Det gör mig frustrerad och omotiverad',
          ],
        },
        dd1then: {
          q: 'Har du testat något för att minska det?',
          multi: true,
          opts: [
            'Avbokningsavgift',
            'Påminnelser via SMS eller meddelande',
            'Förskottsbetalning',
            'Ingenting — vet inte var jag ska börja',
            'Annat',
          ],
        },
      },
    ],
  },

  // ----- Q6: Typical day (write) -----
  {
    id: 6,
    type: 'write',
    title: 'Beskriv en vanlig arbetsdag från morgon till kväll — vad gör du, vad tar tid, vad stressar dig?',
    sub: '',
    aiExamples: [
      'Jag börjar dagen med att gå igenom meddelanden och planeringen. Sedan har jag behandlingar större delen av dagen. Mellan kunder försöker jag hinna med lunch och svara på frågor, ofta via Instagram. Efter sista kunden städar jag, ser över produkter, lägger beställningar och försöker även hinna med sociala medier. Det som tar mest tid och ofta skapar stress är att få ihop kundkontakt, behandlingar och allt administrativt arbete under samma dag.',
    ],
    followUp: {
      q: 'Finns det något specifikt du hade hoppats att {name} kunde hjälpa dig med?',
      aiExamples: [
        'Att svara kunder åt mig på kvällarna',
        'Hjälpa mig att komma ihåg att följa upp kunder',
        'Ge mig idéer på vad jag ska posta',
      ],
    },
  },

  // ----- Q7: Character (handled separately, no opts needed here) -----
  {
    id: 7,
    type: 'character',
    title: 'Om {name} var en karaktär i en film eller serie, vilken skulle du välja?',
    sub: '',
  },
]
