type Coverage = { firstYear: number; lastYear: number };

export function expenditureIntroduction({ firstYear, lastYear }: Coverage): string {
  return `საქართველოს ბიუჯეტის ხარჯები აქ წარმოდგენილია ${firstYear}–${lastYear} წლების ფაქტობრივი შესრულებით. შეადარეთ საჯარო სფეროები, სამინისტროები და ძირითადი პროგრამები, ნახეთ თანხა ლარში ან წილი მშპ-ში და ჩამოტვირთეთ შედეგი CSV ფორმატში. თითოეული სერია ეფუძნება გადამოწმებულ ოფიციალურ საბიუჯეტო დოკუმენტებს.`;
}

export function revenueIntroduction({ firstYear, lastYear }: Coverage): string {
  return `საქართველოს ბიუჯეტის შემოსავლები აქ აერთიანებს ${firstYear}–${lastYear} წლების ფაქტობრივ მონაცემებს: გადასახადებს, გრანტებსა და სხვა შემოსულობებს. შეადარეთ კატეგორიების მრავალწლიანი დინამიკა, ნახეთ თანხა ლარში ან წილი მშპ-ში და ჩამოტვირთეთ წყაროსა და სტატუსის მეტამონაცემებიანი CSV.`;
}

export function analysisIntroduction(latestYear: number): string {
  return `${latestYear} წლის საქართველოს ბიუჯეტის ანალიზი აჩვენებს ფაქტობრივი შემოსავლებისა და ხარჯების სტრუქტურას ერთ გვერდზე. გამოიყენეთ რეიტინგი, ყოველი 100 ლარის განაწილება და შედარებითი ვიზუალები იმის სანახავად, სად მიდის საჯარო ფული და საიდან ივსება ბიუჯეტი.`;
}

export function municipalitiesIntroduction({ firstYear, lastYear }: Coverage): string {
  return `საქართველოს მუნიციპალიტეტების ბიუჯეტები წარმოდგენილია ${firstYear}–${lastYear} წლების ფაქტობრივი შესრულებით. რუკასა და სიაში შეადარეთ ადგილობრივი ბიუჯეტების ჯამები, გახსენით 64 მუნიციპალიტეტისა და 11 რეგიონის ისტორია და ნახეთ ხარჯები ძირითადი ფუნქციების მიხედვით.`;
}

export function municipalityIntroduction(input: Coverage & { nameKa: string }): string {
  if (!input.nameKa.endsWith("მუნიციპალიტეტი")) {
    throw new Error(`Official municipality name must end in მუნიციპალიტეტი: ${input.nameKa}`);
  }
  return `${input.nameKa}ს ბიუჯეტი წარმოდგენილია ${input.firstYear}–${input.lastYear} წლების ფაქტობრივი შესრულებით. გვერდი აჩვენებს მუნიციპალიტეტის საერთო ხარჯს, ადგილს სხვა მუნიციპალიტეტებთან შედარებით და ძირითად ფუნქციურ მიმართულებებს; მონაცემების ჩამოტვირთვა შესაძლებელია CSV ფორმატში.`;
}

export function regionIntroduction(input: Coverage & { genitiveNameKa: string }): string {
  return `${input.genitiveNameKa} მუნიციპალიტეტების ბიუჯეტები წარმოდგენილია ${input.firstYear}–${input.lastYear} წლების ფაქტობრივი შესრულებით. რეგიონული ჯამი აერთიანებს საჯაროდ მოწოდებულ ადგილობრივ ბიუჯეტებს და საშუალებას გაძლევთ შეადაროთ საერთო ხარჯი, ფუნქციები და რეგიონის წევრი მუნიციპალიტეტები.`;
}
