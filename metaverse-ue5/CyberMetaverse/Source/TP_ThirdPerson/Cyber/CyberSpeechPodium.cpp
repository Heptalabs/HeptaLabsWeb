#include "Cyber/CyberSpeechPodium.h"

#include "Components/BoxComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/TextRenderComponent.h"
#include "Cyber/CyberAvatarCharacter.h"
#include "UObject/ConstructorHelpers.h"

ACyberSpeechPodium::ACyberSpeechPodium()
{
	PrimaryActorTick.bCanEverTick = false;

	Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	SetRootComponent(Root);

	PodiumMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("PodiumMesh"));
	PodiumMesh->SetupAttachment(Root);
	PodiumMesh->SetRelativeScale3D(FVector(1.6f, 1.2f, 1.0f));
	PodiumMesh->SetCollisionEnabled(ECollisionEnabled::QueryAndPhysics);
	static ConstructorHelpers::FObjectFinder<UStaticMesh> CubeMesh(TEXT("/Engine/BasicShapes/Cube.Cube"));
	if (CubeMesh.Succeeded())
	{
		PodiumMesh->SetStaticMesh(CubeMesh.Object);
	}

	InteractionBox = CreateDefaultSubobject<UBoxComponent>(TEXT("InteractionBox"));
	InteractionBox->SetupAttachment(Root);
	InteractionBox->SetBoxExtent(FVector(130.0f, 130.0f, 180.0f));
	InteractionBox->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
	InteractionBox->SetCollisionResponseToAllChannels(ECR_Ignore);
	InteractionBox->SetCollisionResponseToChannel(ECC_Visibility, ECR_Block);

	BannerText = CreateDefaultSubobject<UTextRenderComponent>(TEXT("BannerText"));
	BannerText->SetupAttachment(Root);
	BannerText->SetHorizontalAlignment(EHTA_Center);
	BannerText->SetVerticalAlignment(EVRTA_TextCenter);
	BannerText->SetWorldSize(44.0f);
	BannerText->SetRelativeLocation(FVector(0.0f, 0.0f, 250.0f));

	SpeechLines = {
		TEXT("도시는 우리 것, 규칙은 우리가 만든다!"),
		TEXT("상점과 카지노, 그리고 광장이 하나의 생태계다."),
		TEXT("사이버펑크 시대의 주인공은 바로 우리다.")
	};

	SetBanner(TEXT("NO SPEAKER"));
}

FString ACyberSpeechPodium::GetInteractLabel(const ACyberAvatarCharacter* Requester) const
{
	if (CurrentSpeaker.IsValid())
	{
		if (CurrentSpeaker.Get() == Requester)
		{
			return TEXT("[E] 연설 종료");
		}
		return TEXT("단상 사용 중");
	}
	return TEXT("[E] 단상 연설 시작");
}

void ACyberSpeechPodium::Interact(ACyberAvatarCharacter* Character)
{
	if (!Character)
	{
		return;
	}

	if (!CurrentSpeaker.IsValid())
	{
		CurrentSpeaker = Character;
		SpeechCursor = 0;
		SetBanner(TEXT("연설 시작: [1/2/3] 멘트 송출"));
		Character->OpenSpeech(this);
		Character->PushStatusMessage(TEXT("연설 모드 진입"));
		return;
	}

	if (CurrentSpeaker.Get() == Character)
	{
		CurrentSpeaker = nullptr;
		SetBanner(TEXT("NO SPEAKER"));
		Character->CloseInteractionMode();
		Character->PushStatusMessage(TEXT("연설 모드 종료"));
	}
}

void ACyberSpeechPodium::HandleOption(ACyberAvatarCharacter* Character, int32 OptionIndex)
{
	if (!Character || !CurrentSpeaker.IsValid() || CurrentSpeaker.Get() != Character || SpeechLines.Num() == 0)
	{
		return;
	}

	SpeechCursor = (SpeechCursor + OptionIndex) % SpeechLines.Num();
	const FString& Line = SpeechLines[SpeechCursor];
	SetBanner(Line);
	Character->PushStatusMessage(FString::Printf(TEXT("연설 송출: %s"), *Line));
}

bool ACyberSpeechPodium::IsCurrentSpeaker(const ACyberAvatarCharacter* Character) const
{
	return CurrentSpeaker.IsValid() && CurrentSpeaker.Get() == Character;
}

FString ACyberSpeechPodium::BuildMenuText() const
{
	return TEXT("[연설대] 1/2/3: 멘트 변경 | [E] 연설 종료");
}

void ACyberSpeechPodium::SetBanner(const FString& Text)
{
	BannerText->SetText(FText::FromString(Text));
}
